/**
 * generateControllers.ts
 *
 * Parses types.d.ts and generates tsoa-decorated controller files
 * for all Adobe Premiere Pro UXP API types.
 *
 * Static types (e.g., ProjectStatic) → ProjectStaticController
 * Instance types (e.g., Project)     → ProjectController
 */

import {
  Project as TsMorphProject,
  TypeAliasDeclaration,
  TypeElementTypes,
  MethodSignature,
  PropertySignature,
  Type,
  Node,
} from "ts-morph";
import * as path from "path";
import * as fs from "fs";

const TYPES_DTS_PATH = path.resolve(__dirname, "../../types.d.ts");
const OUTPUT_DIR = path.resolve(__dirname, "../src/controllers/generated");

// Map from premierepro namespace key → StaticTypeName
// e.g., "Project" → "ProjectStatic"
const premiereMappings = new Map<string, string>();

// ----------- helper: kebab-case route names -----------
function toKebab(name: string): string {
  return name
    .replace(/([A-Z])/g, (m, l, i) => (i === 0 ? l.toLowerCase() : `-${l.toLowerCase()}`))
    .replace(/--+/g, "-");
}

// ----------- helper: determine HTTP verb -----------
function httpVerb(methodName: string): "Get" | "Post" {
  const getVerbs = /^(get|is|has|list|fetch|check|find)/i;
  return getVerbs.test(methodName) ? "Get" : "Post";
}

// ----------- helper: serialise a TS type to an OAS-friendly string -----------
function serialiseType(
  type: Type,
  depth = 0
): {
  tsType: string;
  importedTypes: Set<string>;
} {
  const imported = new Set<string>();

  if (depth > 3) return { tsType: "unknown", importedTypes: imported };

  const typeText = type.getText();

  // Promise<T> → unwrap
  if (typeText.startsWith("Promise<") && typeText.endsWith(">")) {
    return serialiseType(type.getTypeArguments()[0]!, depth + 1);
  }

  // Arrays
  if (type.isArray()) {
    const inner = serialiseType(type.getArrayElementTypeOrThrow(), depth + 1);
    for (const i of inner.importedTypes) imported.add(i);
    return { tsType: `${inner.tsType}[]`, importedTypes: imported };
  }

  // Unions (filter out undefined/null for optionals)
  if (type.isUnion()) {
    const nonNull = type.getUnionTypes().filter((t) => !t.isNull() && !t.isUndefined());
    if (nonNull.length === 1) return serialiseType(nonNull[0]!, depth + 1);
    const parts = nonNull.map((t) => serialiseType(t, depth + 1));
    for (const p of parts) for (const i of p.importedTypes) imported.add(i);
    return { tsType: parts.map((p) => p.tsType).join(" | "), importedTypes: imported };
  }

  // Primitives
  if (type.isString()) return { tsType: "string", importedTypes: imported };
  if (type.isNumber()) return { tsType: "number", importedTypes: imported };
  if (type.isBoolean()) return { tsType: "boolean", importedTypes: imported };
  if (typeText === "void" || typeText === "undefined" || typeText === "null")
    return { tsType: "void", importedTypes: imported };

  // Known serialised Premiere Pro types → we expose only their identity fields
  const PREMIERE_IDENTITY_TYPES = new Set([
    "Project",
    "Sequence",
    "ProjectItem",
    "ClipProjectItem",
    "FolderItem",
    "VideoTrack",
    "AudioTrack",
    "CaptionTrack",
    "VideoClipTrackItem",
    "AudioClipTrackItem",
    "Marker",
    "PRProduction",
    "VideoFilterComponent",
    "AudioFilterComponent",
    "VideoComponentChain",
    "AudioComponentChain",
    "Keyframe",
  ]);

  // Guid → string
  if (typeText === "Guid") return { tsType: "string", importedTypes: imported };

  // TickTime → use serialised wrapper
  if (typeText === "TickTime") {
    imported.add("SerializedTickTime");
    return { tsType: "SerializedTickTime", importedTypes: imported };
  }

  // Action → void (fire-and-forget command object)
  if (typeText === "Action") return { tsType: "void", importedTypes: imported };

  // Known identity types → return serialised form
  const baseName = typeText.replace(/\[\]$/, "");
  if (PREMIERE_IDENTITY_TYPES.has(baseName)) {
    const serialName = `Serialized${baseName}`;
    imported.add(serialName);
    return {
      tsType: typeText.endsWith("[]") ? `${serialName}[]` : serialName,
      importedTypes: imported,
    };
  }

  // Anything else → unknown (will be cast at runtime)
  return { tsType: "unknown", importedTypes: imported };
}

// ----------- helper: serialise a parameter type to a simple primitive -----------
function serialiseParamType(type: Type): string {
  const typeText = type.getText();

  if (typeText.startsWith("Promise<")) {
    return serialiseParamType(type.getTypeArguments()[0]!);
  }

  // Optional unwrap
  if (type.isUnion()) {
    const nonNull = type.getUnionTypes().filter((t) => !t.isNull() && !t.isUndefined());
    if (nonNull.length === 1) return serialiseParamType(nonNull[0]!);
  }

  if (type.isString()) return "string";
  if (type.isNumber()) return "number";
  if (type.isBoolean()) return "boolean";
  if (typeText === "Guid") return "string";
  if (typeText === "TickTime") return "string"; // seconds as ISO string or numeric string
  if (type.isArray()) return `${serialiseParamType(type.getArrayElementTypeOrThrow())}[]`;

  // Premiere Pro object types → passed as guid string
  return "string";
}

interface MethodInfo {
  name: string;
  verb: "Get" | "Post";
  params: Array<{ name: string; tsType: string; optional?: boolean }>;
  returnType: string;
  importedTypes: Set<string>;
  jsDoc: string;
}

function extractMethods(typeAlias: TypeAliasDeclaration): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const node = typeAlias.getTypeNode();
  if (!Node.isTypeLiteral(node)) return methods;

  for (const member of node.getMembers()) {
    if (!Node.isMethodSignature(member as TypeElementTypes)) continue;
    const method = member as MethodSignature;
    const name = method.getName();

    // Skip constructors, event-only members, and Object prototype built-ins
    const SKIP_NAMES = new Set(["()", "toString", "valueOf", "toLocaleString", "hasOwnProperty", "isPrototypeOf"]);
    if (SKIP_NAMES.has(name)) continue;

    const retSerialized = serialiseType(method.getReturnType());
    const params: MethodInfo["params"] = [];

    for (const param of method.getParameters()) {
      const paramType = param.getType();
      const serialised = serialiseParamType(paramType);
      params.push({
        name: param.getName(),
        tsType: serialised,
        optional: param.isOptional(),
      });
    }

    // jsDoc
    const docs = method.getJsDocs();
    const jsDoc =
      docs.length > 0
        ? docs
            .map((d) => d.getDescription().trim())
            .filter(Boolean)
            .join("\n")
        : "";

    methods.push({
      name,
      verb: httpVerb(name),
      params,
      returnType: retSerialized.tsType,
      importedTypes: retSerialized.importedTypes,
      jsDoc,
    });
  }

  return methods;
}

interface PropertyInfo {
  name: string;
  tsType: string;
  importedTypes: Set<string>;
  jsDoc: string;
}

function extractProperties(typeAlias: TypeAliasDeclaration): PropertyInfo[] {
  const props: PropertyInfo[] = [];
  const node = typeAlias.getTypeNode();
  if (!Node.isTypeLiteral(node)) return props;

  for (const member of node.getMembers()) {
    if (!Node.isPropertySignature(member as TypeElementTypes)) continue;
    const prop = member as PropertySignature;
    if (!prop.isReadonly()) continue; // only expose readable props

    const name = prop.getName();
    const retSerialized = serialiseType(prop.getType());

    const docs = prop.getJsDocs();
    const jsDoc =
      docs.length > 0
        ? docs
            .map((d) => d.getDescription().trim())
            .filter(Boolean)
            .join("\n")
        : "";

    props.push({
      name,
      tsType: retSerialized.tsType,
      importedTypes: retSerialized.importedTypes,
      jsDoc,
    });
  }

  return props;
}

// ----------- main generation logic -----------

function generateControllerSource(
  typeName: string, // e.g., "Project" or "ProjectStatic"
  isStatic: boolean,
  methods: MethodInfo[],
  properties: PropertyInfo[]
): string {
  const controllerName = `${typeName}Controller`;
  const routeName = toKebab(typeName);

  // Collect all imported serialised types
  const allImportedTypes = new Set<string>();
  for (const m of methods) for (const i of m.importedTypes) allImportedTypes.add(i);
  for (const p of properties) for (const i of p.importedTypes) allImportedTypes.add(i);

  const sharedImport =
    allImportedTypes.size > 0
      ? `import { ${[...allImportedTypes].join(", ")} } from "../shared/serializedTypes";`
      : "";

  const instanceParam = isStatic
    ? null
    : { name: `${typeName[0]!.toLowerCase()}${typeName.slice(1)}Guid`, tsType: "string" };

  // Build method strings
  const methodSources: string[] = [];

  for (const prop of properties) {
    const allParams = instanceParam ? [instanceParam] : [];
    const paramList = allParams
      .map((p) => `@Query() ${p.name}: ${p.tsType}`)
      .join(", ");

    const body = `
  /**
   * Get property '${prop.name}' on ${typeName}.
   * ${prop.jsDoc}
   */
  @Get("${prop.name}")
  public async get${prop.name.charAt(0).toUpperCase()}${prop.name.slice(1)}(${paramList}): Promise<${prop.tsType}> {
    return (await uxpBridge.invoke("${typeName}.${prop.name}", { ${allParams.map((p) => p.name).join(", ")} })) as ${prop.tsType};
  }`;
    methodSources.push(body);
  }

  for (const method of methods) {
    const allParams: Array<{ name: string; tsType: string; optional?: boolean }> = [
      ...(instanceParam ? [instanceParam] : []),
      ...method.params,
    ];

    const isGet = method.verb === "Get";
    const paramDecorator = isGet ? "@Query()" : "@Body()";

    let paramList: string;
    if (isGet) {
      paramList = allParams
        .map((p) => `${paramDecorator} ${p.name}${p.optional ? "?" : ""}: ${p.tsType}`)
        .join(", ");
    } else {
      // For POST, use individual @Body() params or a body object
      if (allParams.length === 0) {
        paramList = "";
      } else {
        const bodyType = `{ ${allParams.map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.tsType}`).join("; ")} }`;
        paramList = `@Body() body: ${bodyType}`;
      }
    }

    const argsExpr = isGet
      ? `{ ${allParams.map((p) => p.name).join(", ")} }`
      : allParams.length === 0
      ? "{}"
      : "body";

    const returnTs =
      method.returnType === "void" ? "Promise<void>" : `Promise<${method.returnType}>`;
    const castReturn =
      method.returnType === "void"
        ? `await uxpBridge.invoke("${typeName}.${method.name}", ${argsExpr});`
        : `return (await uxpBridge.invoke("${typeName}.${method.name}", ${argsExpr})) as ${method.returnType};`;

    const body = `
  /**
   * ${method.jsDoc || method.name}
   */
  @${method.verb}("${method.name}")
  public async ${method.name}(${paramList}): ${returnTs} {
    ${castReturn}
  }`;
    methodSources.push(body);
  }

  const uxpBridgeImport = `import { uxpBridge } from "../../server";`;

  return `// AUTO-GENERATED — do not edit. Run \`npm run generate:api\` to regenerate.
import { Controller, Get, Post, Route, Tags, Query, Body } from "tsoa";
${uxpBridgeImport}
${sharedImport}

@Route("${routeName}")
@Tags("${typeName}")
export class ${controllerName} extends Controller {
${methodSources.join("\n")}
}
`;
}

// ----------- entry point -----------

async function main(): Promise<void> {
  const project = new TsMorphProject({
    skipAddingFilesFromTsConfig: true,
  });

  project.addSourceFileAtPath(TYPES_DTS_PATH);

  const sourceFile = project.getSourceFileOrThrow(TYPES_DTS_PATH);

  // 1. Find premierepro type and build namespace mapping
  const premieroproType = sourceFile.getTypeAliasOrThrow("premierepro");
  const premieroproNode = premieroproType.getTypeNode();
  if (!Node.isTypeLiteral(premieroproNode)) throw new Error("premierepro is not a type literal");

  for (const member of premieroproNode.getMembers()) {
    if (!Node.isPropertySignature(member as TypeElementTypes)) continue;
    const prop = member as PropertySignature;
    const name = prop.getName();
    const typeText = prop.getType().getText();
    // e.g., "ProjectStatic", "typeof Constants"
    if (!typeText.startsWith("typeof ")) {
      premiereMappings.set(name, typeText);
    }
  }

  // 2. Ensure output directory exists and clean stale generated files
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const existing of fs.readdirSync(OUTPUT_DIR)) {
    if (existing.endsWith("Controller.ts")) {
      fs.unlinkSync(path.join(OUTPUT_DIR, existing));
    }
  }

  const generated: string[] = [];

  // 3. Process each type alias in the file
  for (const typeAlias of sourceFile.getTypeAliases()) {
    const name = typeAlias.getName();

    // Skip the top-level premierepro and utility types
    if (["premierepro", "Action", "Constants"].includes(name)) continue;
    // Skip types ending in options/event/settings that we don't expose directly
    const SKIP_SUFFIXES = ["Options", "Event", "Settings", "Selection", "Factory"];
    if (SKIP_SUFFIXES.some((s) => name.endsWith(s) && name !== "SequenceSettings")) continue;

    const isStatic = name.endsWith("Static");
    const baseName = isStatic ? name.slice(0, -"Static".length) : name;

    // Only process types that are referenced in the premierepro mapping
    const isInMapping = premiereMappings.has(baseName);
    if (!isInMapping) continue;

    const methods = extractMethods(typeAlias);
    const properties = extractProperties(typeAlias);

    if (methods.length === 0 && properties.length === 0) continue;

    const typeName = name;
    const source = generateControllerSource(typeName, isStatic, methods, properties);
    const outFile = path.join(OUTPUT_DIR, `${typeName}Controller.ts`);
    fs.writeFileSync(outFile, source, "utf8");
    generated.push(typeName);
    console.log(`Generated ${typeName}Controller.ts (${methods.length} methods, ${properties.length} properties)`);
  }

  // 4. Generate shared serialized types file
  generateSharedTypes();

  console.log(`\nDone. Generated ${generated.length} controllers.`);
}

function generateSharedTypes(): void {
  const sharedDir = path.resolve(__dirname, "../src/controllers/shared");
  fs.mkdirSync(sharedDir, { recursive: true });

  const content = `// AUTO-GENERATED — do not edit. Run \`npm run generate:api\` to regenerate.

export interface SerializedProject {
  guid: string;
  name: string;
  path: string;
}

export interface SerializedSequence {
  guid: string;
  name: string;
}

export interface SerializedProjectItem {
  guid: string;
  name: string;
  type: number;
}

export interface SerializedClipProjectItem {
  guid: string;
  name: string;
}

export interface SerializedFolderItem {
  guid: string;
  name: string;
}

export interface SerializedVideoTrack {
  index: number;
  name: string;
}

export interface SerializedAudioTrack {
  index: number;
  name: string;
}

export interface SerializedCaptionTrack {
  index: number;
  name: string;
}

export interface SerializedVideoClipTrackItem {
  name: string;
  startTime: SerializedTickTime;
  endTime: SerializedTickTime;
}

export interface SerializedAudioClipTrackItem {
  name: string;
  startTime: SerializedTickTime;
  endTime: SerializedTickTime;
}

export interface SerializedMarker {
  guid: string;
  name: string;
  start: SerializedTickTime;
  end: SerializedTickTime;
  type: string;
}

export interface SerializedPRProduction {
  guid: string;
  name: string;
}

export interface SerializedVideoFilterComponent {
  matchName: string;
  displayName: string;
}

export interface SerializedAudioFilterComponent {
  matchName: string;
  displayName: string;
}

export interface SerializedVideoComponentChain {
  numComponents: number;
}

export interface SerializedAudioComponentChain {
  numComponents: number;
}

export interface SerializedKeyframe {
  time: SerializedTickTime;
}

export interface SerializedTickTime {
  /** Time in seconds */
  seconds: number;
  /** Ticks representation (optional) */
  ticks?: string;
}
`;

  fs.writeFileSync(path.join(sharedDir, "serializedTypes.ts"), content, "utf8");
  console.log("Generated src/controllers/shared/serializedTypes.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
