/**
 * generateDispatchers.ts
 *
 * Reads the generated tsoa controller files and produces:
 *  1. src/generated/wsExternalDispatcher.ts  — switch/case router for the external WS server
 *  2. ../plugin/src/generated/wsReceiver.ts  — switch/case receiver for the UXP plugin
 *
 * The UXP receiver maps each action to the real Adobe UXP DOM API call via the
 * premierepro global object. It maintains an in-memory object registry so that
 * instance methods can be resolved by GUID.
 */

import {
  Project as TsMorphProject,
  TypeAliasDeclaration,
  Node,
  PropertySignature,
  MethodSignature,
  TypeElementTypes,
} from "ts-morph";
import * as path from "path";
import * as fs from "fs";

const TYPES_DTS_PATH = path.resolve(__dirname, "../../types.d.ts");
const CONTROLLERS_DIR = path.resolve(__dirname, "../src/controllers/generated");
const SERVER_GENERATED_DIR = path.resolve(__dirname, "../src/generated");
const PLUGIN_GENERATED_DIR = path.resolve(__dirname, "../../plugin/src/generated");

// ----------- Parse premierepro namespace to know which types are statics -----------

function buildPremiereMappings(): Map<string, string> {
  const project = new TsMorphProject({ skipAddingFilesFromTsConfig: true });
  project.addSourceFileAtPath(TYPES_DTS_PATH);
  const sourceFile = project.getSourceFileOrThrow(TYPES_DTS_PATH);
  const premieroproType = sourceFile.getTypeAliasOrThrow("premierepro");
  const premieroproNode = premieroproType.getTypeNode();

  const mappings = new Map<string, string>();
  if (!Node.isTypeLiteral(premieroproNode)) return mappings;

  for (const member of premieroproNode.getMembers()) {
    if (!Node.isPropertySignature(member as TypeElementTypes)) continue;
    const prop = member as PropertySignature;
    const name = prop.getName();
    const typeText = prop.getType().getText();
    if (!typeText.startsWith("typeof ")) {
      mappings.set(name, typeText); // e.g. "Project" → "ProjectStatic"
    }
  }

  return mappings;
}

// ----------- Parse types.d.ts to get UXP method signatures and properties -----------

interface UxpParam {
  name: string;
  uxpType: string; // original type text from types.d.ts
}

interface UxpTypeInfo {
  /** key: "TypeName.methodName" → params */
  methods: Map<string, UxpParam[]>;
  /** set of "TypeName.propertyName" (original property names, case-exact) */
  properties: Set<string>;
}

function buildUxpTypeInfo(): UxpTypeInfo {
  const project = new TsMorphProject({ skipAddingFilesFromTsConfig: true });
  project.addSourceFileAtPath(TYPES_DTS_PATH);
  const sourceFile = project.getSourceFileOrThrow(TYPES_DTS_PATH);

  const SKIP_METHODS = new Set(["()", "toString", "valueOf", "toLocaleString", "hasOwnProperty", "isPrototypeOf"]);

  const methods = new Map<string, UxpParam[]>();
  const properties = new Set<string>();

  for (const typeAlias of sourceFile.getTypeAliases()) {
    const typeName = typeAlias.getName();
    const typeNode = typeAlias.getTypeNode();
    if (!Node.isTypeLiteral(typeNode)) continue;

    for (const member of typeNode.getMembers()) {
      if (Node.isMethodSignature(member as TypeElementTypes)) {
        const method = member as MethodSignature;
        const methodName = method.getName();
        if (SKIP_METHODS.has(methodName)) continue;
        const params: UxpParam[] = method.getParameters().map((p) => ({
          name: p.getName(),
          uxpType: p.getType().getText(),
        }));
        methods.set(`${typeName}.${methodName}`, params);
      } else if (Node.isPropertySignature(member as TypeElementTypes)) {
        const prop = member as PropertySignature;
        // Expose all readable properties (readonly or regular)
        properties.add(`${typeName}.${prop.getName()}`);
      }
    }
  }

  return { methods, properties };
}

/**
 * Given a controller methodName like getKEY_AUTO_PEAK_GENERATION or getName,
 * returns the UXP property name if this method is a property accessor, or null if it's a real method.
 */
function resolveUxpPropertyName(typeName: string, methodName: string, uxpTypeInfo: UxpTypeInfo): string | null {
  if (!methodName.startsWith("get")) return null;
  // The controller getter name is: get + capitalize(propName)
  // To recover propName: try the raw slice (handles UPPER_CASE), then lowercase-first (handles camelCase)
  const rawSlice = methodName.slice(3); // e.g. "KEY_AUTO_PEAK_GENERATION" or "Name"
  if (uxpTypeInfo.properties.has(`${typeName}.${rawSlice}`)) return rawSlice;
  const lcSlice = rawSlice.charAt(0).toLowerCase() + rawSlice.slice(1); // "name", "id"
  if (uxpTypeInfo.properties.has(`${typeName}.${lcSlice}`)) return lcSlice;
  return null;
}

/**
 * Generates a JavaScript expression to pass a single UXP argument from the incoming args record.
 * Handles TickTime reconstruction, Guid wrapping, and registry lookups for UXP object types.
 */
function buildUxpArgExpr(
  argName: string,
  uxpType: string,
  instanceTypeNames: Set<string>
): string {
  // Normalize "import(...).TypeName" → "TypeName"
  const normalized = uxpType.replace(/import\([^)]+\)\./g, "").trim();

  // Strip optional / null from union
  const baseType = normalized
    .split("|")
    .map((t) => t.trim())
    .filter((t) => t !== "undefined" && t !== "null")
    .join(" | ");

  if (baseType === "TickTime") {
    return `premierepro.TickTime.createWithSeconds(parseFloat(String(args.${argName})))`;
  }
  if (baseType === "Guid" || argName.endsWith("Guid") || argName === "guid") {
    return `premierepro.Guid.fromString(String(args.${argName}))`;
  }
  if (baseType === "string") return `String(args.${argName})`;
  if (baseType === "number") return `Number(args.${argName})`;
  if (baseType === "boolean") return `(args.${argName} === true || args.${argName} === "true")`;

  // Check if the base type is a known UXP instance type (needs registry lookup)
  if (instanceTypeNames.has(baseType)) {
    return `registry.get(String(args.${argName})) as any`;
  }

  // Unknown / complex type — pass through as-is
  return `args.${argName} as any`;
}

// ----------- Scan generated controller files for method metadata -----------

interface ActionMeta {
  typeName: string;   // e.g., "Project" or "ProjectStatic"
  methodName: string; // e.g., "getActiveSequence"
  httpVerb: "Get" | "Post";
  params: string[];   // parameter names extracted from controller
  returnType: string;
  isStatic: boolean;
  instanceBaseType: string | null; // e.g., "Project" for a ProjectStatic controller
}

function scanControllers(premiereMappings: Map<string, string>): ActionMeta[] {
  const actions: ActionMeta[] = [];

  if (!fs.existsSync(CONTROLLERS_DIR)) {
    console.warn(`Controllers directory not found: ${CONTROLLERS_DIR}. Run generate:api first.`);
    return actions;
  }

  const controllerProject = new TsMorphProject({ skipAddingFilesFromTsConfig: true });
  const files = fs.readdirSync(CONTROLLERS_DIR).filter((f: string) => f.endsWith("Controller.ts"));

  for (const file of files) {
    controllerProject.addSourceFileAtPath(path.join(CONTROLLERS_DIR, file));
  }

  for (const sourceFile of controllerProject.getSourceFiles()) {
    for (const classDecl of sourceFile.getClasses()) {
      const className = classDecl.getName() ?? "";
      if (!className.endsWith("Controller")) continue;

      // Determine type name from class name: "ProjectStaticController" → "ProjectStatic"
      const typeName = className.slice(0, -"Controller".length);
      const isStatic = typeName.endsWith("Static");
      const baseName = isStatic ? typeName.slice(0, -"Static".length) : typeName;
      const instanceBaseType = premiereMappings.has(baseName) ? baseName : null;

      for (const method of classDecl.getMethods()) {
        const methodName = method.getName();
        if (methodName.startsWith("_") || !method.isAsync()) continue;

        // Determine verb from decorators
        const decorators = method.getDecorators().map((d) => d.getName());
        const httpVerb: "Get" | "Post" = decorators.includes("Post") ? "Post" : "Get";

        // Collect parameter names
        const params = method.getParameters().map((p) => p.getName());

        // Return type text (strip Promise<>)
        let returnType = method.getReturnType().getText();
        if (returnType.startsWith("Promise<") && returnType.endsWith(">")) {
          returnType = returnType.slice(8, -1);
        }

        actions.push({
          typeName,
          methodName,
          httpVerb,
          params,
          returnType,
          isStatic,
          instanceBaseType,
        });
      }
    }
  }

  return actions;
}

// ----------- UXP resolver helpers -----------

// Map from base type name to how to resolve an instance from the registry or premierepro
function uxpResolveExpression(baseName: string, guidArg: string): string {
  // Project can be resolved directly via premierepro.Project.getProject
  if (baseName === "Project") {
    return `await premierepro.Project.getProject(premierepro.Guid.fromString(${guidArg}))`;
  }
  return `(() => {
    const obj = registry.get(${guidArg});
    if (obj === undefined) throw new Error(\`${baseName} not found in registry: \${${guidArg}}\`);
    return obj;
  })()`;
}

// ----------- Generate external WS dispatcher -----------

function generateExternalDispatcher(actions: ActionMeta[]): string {
  const cases = actions.map((a) => {
    const actionKey = `${a.typeName}.${a.methodName}`;

    // The external dispatcher just forwards to the UXP bridge
    return `    case "${actionKey}": {
      return await uxpBridge.invoke("${actionKey}", args);
    }`;
  });

  return `// AUTO-GENERATED — do not edit. Run \`npm run generate:dispatchers\` to regenerate.
import { UxpBridgeManager } from "../ws/uxpBridgeManager";

export async function dispatchExternalWsMessage(
  action: string,
  args: Record<string, unknown>,
  uxpBridge: UxpBridgeManager
): Promise<unknown> {
  switch (action) {
${cases.join("\n")}
    default:
      throw new Error(\`Unknown action: \${action}\`);
  }
}
`;
}

// ----------- Generate UXP plugin receiver -----------

function generateUxpReceiver(
  actions: ActionMeta[],
  premiereMappings: Map<string, string>,
  uxpTypeInfo: UxpTypeInfo
): string {
  // Set of UXP instance type names for registry lookups
  const instanceTypeNames = new Set(premiereMappings.keys());

  // Build the switch cases for the UXP receiver
  const cases = actions.map((a) => {
    const actionKey = `${a.typeName}.${a.methodName}`;
    const isStatic = a.isStatic;
    const baseName = a.instanceBaseType ?? a.typeName.replace(/Static$/, "");

    let invocationExpr: string;

    if (isStatic) {
      // Check if this is a property accessor (e.g., getKEY_AUTO_PEAK_GENERATION → KEY_AUTO_PEAK_GENERATION)
      const propName = resolveUxpPropertyName(a.typeName, a.methodName, uxpTypeInfo);
      if (propName !== null) {
        // Property access: premierepro.Base.PROP_NAME
        invocationExpr = `premierepro.${baseName}.${propName}`;
      } else {
        // Method call — use UXP params for proper arg conversion
        const uxpParams = uxpTypeInfo.methods.get(actionKey) ?? [];
        const argsList = uxpParams
          .map((p) => buildUxpArgExpr(p.name, p.uxpType, instanceTypeNames))
          .join(", ");
        invocationExpr = `await premierepro.${baseName}.${a.methodName}(${argsList})`;
      }
    } else {
      // Instance method or property
      const guidParamName = `${baseName.charAt(0).toLowerCase()}${baseName.slice(1)}Guid`;
      const resolveExpr = uxpResolveExpression(baseName, `String(args.${guidParamName})`);

      const propName = resolveUxpPropertyName(a.typeName, a.methodName, uxpTypeInfo);
      if (propName !== null) {
        // Property access on instance
        invocationExpr = `(async () => {
        const instance = ${resolveExpr};
        return (instance as any).${propName};
      })()`;
      } else {
        // Method call — use UXP params (excluding guid) for proper arg conversion
        const uxpParams = uxpTypeInfo.methods.get(actionKey) ?? [];
        const uxpArgsList = uxpParams
          .map((p) => buildUxpArgExpr(p.name, p.uxpType, instanceTypeNames))
          .join(", ");
        invocationExpr = `(async () => {
        const instance = ${resolveExpr};
        return await (instance as any).${a.methodName}(${uxpArgsList});
      })()`;
      }
    }

    const awaitedExpr = invocationExpr.startsWith("(async")
      ? `await ${invocationExpr}`
      : `await Promise.resolve(${invocationExpr})`;

    return `    case "${actionKey}": {
      try {
        const result = ${awaitedExpr};
        const serialized = serializeResult(result);
        ws.send(JSON.stringify({ requestId: msg.requestId, result: serialized }));
      } catch (err) {
        ws.send(JSON.stringify({ requestId: msg.requestId, error: err instanceof Error ? err.message : String(err) }));
      }
      break;
    }`;
  });

  return `// AUTO-GENERATED — do not edit. Run \`npm run generate:dispatchers\` to regenerate.
// This file is imported by the UXP plugin entry point.

declare const premierepro: import("../../../types").premierepro;

/** In-memory registry mapping GUID strings → live UXP objects */
const registry = new Map<string, unknown>();

interface BridgeMessage {
  requestId: string;
  action: string;
  args?: Record<string, unknown>;
}

/**
 * Serializes a raw UXP result to a JSON-safe representation.
 * Live UXP objects are cached in the registry and returned as { guid, name }.
 */
function serializeResult(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(serializeResult);

  // Check for UXP objects with a guid property
  const obj = value as Record<string, unknown>;
  if (typeof obj["toString"] === "function" && obj["guid"] !== undefined) {
    const guidObj = obj["guid"] as { toString(): string };
    const guidStr = guidObj.toString();
    registry.set(guidStr, value);
    return {
      guid: guidStr,
      name: typeof obj["name"] === "string" ? obj["name"] : undefined,
      path: typeof obj["path"] === "string" ? obj["path"] : undefined,
    };
  }

  // TickTime-like objects
  if (typeof obj["seconds"] === "number") {
    return { seconds: obj["seconds"], ticks: obj["ticks"] };
  }

  return obj;
}

export async function handleBridgeMessage(ws: WebSocket, msg: BridgeMessage): Promise<void> {
  const args = msg.args ?? {};

  switch (msg.action) {
${cases.join("\n")}
    default: {
      ws.send(JSON.stringify({
        requestId: msg.requestId,
        error: \`Unknown action: \${msg.action}\`,
      }));
    }
  }
}
`;
}

// ----------- entry point -----------

async function main(): Promise<void> {
  const premiereMappings = buildPremiereMappings();
  const uxpTypeInfo = buildUxpTypeInfo();
  const actions = scanControllers(premiereMappings);

  console.log(`Scanned ${actions.length} actions from controllers.`);

  // Ensure output directories exist
  fs.mkdirSync(SERVER_GENERATED_DIR, { recursive: true });
  fs.mkdirSync(PLUGIN_GENERATED_DIR, { recursive: true });

  // Generate external WS dispatcher
  const dispatcherSource = generateExternalDispatcher(actions);
  fs.writeFileSync(
    path.join(SERVER_GENERATED_DIR, "wsExternalDispatcher.ts"),
    dispatcherSource,
    "utf8"
  );
  console.log("Generated src/generated/wsExternalDispatcher.ts");

  // Generate UXP plugin receiver
  const receiverSource = generateUxpReceiver(actions, premiereMappings, uxpTypeInfo);
  fs.writeFileSync(
    path.join(PLUGIN_GENERATED_DIR, "wsReceiver.ts"),
    receiverSource,
    "utf8"
  );
  console.log("Generated plugin/src/generated/wsReceiver.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
