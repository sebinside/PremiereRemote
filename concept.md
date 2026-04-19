# Architecture & Implementation Specification: Premiere Remote (UXP)

## 1. Context & Background
Adobe is deprecating CEP (Common Extensibility Platform) in favor of UXP (Unified Extensibility Platform). Unlike CEP, UXP relies strictly on a V8 JavaScript engine without native Node.js integration. 
**Crucial Restriction:** UXP plugins operate in a strict sandbox. They cannot host local servers (HTTP or WebSocket) or bind to TCP ports. They can only initiate *outbound* network connections. Therefore, the legacy architecture (hosting an Express/WS server directly inside Premiere) must be completely replaced by a decoupled architecture.

## 2. Core Design Decisions
* **Decoupled "Companion App" Architecture:** The system is split into a standalone Node.js backend (acting as a gateway) and a "dumb" UXP client inside Premiere Pro.
* **Single Source of Truth (SSOT):** All business logic and external APIs are strictly defined via TypeScript interfaces and controller classes in the Node.js backend.
* **Maximum Code Generation:** To prevent manual boilerplate and ensure type safety across process boundaries, the architecture heavily relies on generators (`tsoa`, `ts-morph`, `Kubb`).
* **Stateless Operations:** Because live Adobe UXP objects (like sequences or clips) cannot be serialized over WebSockets, all commands passed to the UXP client must be ID-based and stateless (e.g., `deleteClip(sequenceId, clipId)`).
* **Health & Status Transparency:** All communication layers (REST, WebSockets, Internal Bridge) must implement explicit status/health endpoints or message types so clients can instantly verify if the server is running and if the UXP plugin is actively connected. *(Note: Manual WebSocket ping/pong logic is explicitly excluded from scope).*

## 3. Directory Structure
The monorepo is organized into three primary top-level directories:

* `/server`: The Node.js standalone backend (Express, WS, OpenAPI, MCP).
* `/plugin`: The Adobe UXP plugin codebase (the WebSocket client and Adobe DOM executor).
* `/sample-client`: A rich, fully-featured CLI (Command Line Interface) demonstration application. This serves as a "living product" utilizing the `Kubb`-generated client to demonstrate the full capabilities of the Premiere Remote APIs. It accepts parameters and instructions via the command line to control the server.

## 4. Development Environment & Containerization
To ensure a consistent development experience and reliable deployments:
* **Dev Containers:** Development for the `/server` and the `/sample-client` must be unified using Dev Containers. Both environments share the same Dev Container configuration. The `/plugin` is explicitly excluded from the Dev Container setup, as UXP development requires native host OS access to interface with Adobe Premiere Pro. The dev container files must be located in the .devcontainer dir at root level, as well as the appropriate dockerfile
* **Dockerization:** For final distribution and testing, both the Node.js `/server` and the CLI `/sample-client` are containerized using Docker. Each requires its own production-ready `Dockerfile`.

## 5. System Components & Interfaces
The Node.js backend (`/server`) acts as an API Gateway and RPC bridge, managing four distinct communication channels:

1.  **REST API (External):** Standard HTTP endpoints for traditional integrations. Includes a `GET /health` route detailing server and plugin connection status.
2.  **MCP Server (External):** Tool definitions allowing LLMs and AI agents to orchestrate Premiere Pro natively.
3.  **External WebSocket (External):** Low-latency, bidirectional communication for external tools (`ws://localhost:PORT/api/`). Must support health/status inquiry messages.
4.  **Internal WebSocket Bridge (Internal):** The dedicated, outbound-only connection initiated by the Adobe UXP Plugin (`ws://localhost:PORT/uxp-bridge`).

## 6. The Code Generation Pipeline
All APIs, API documentation, client SDKs, and WebSocket dispatchers are generated from the TypeScript controllers. The `package.json` must expose granular commands alongside a master command:

* `npm run generate:api`: Triggers `tsoa` to parse the controllers and generate Express routes and `openapi.json`.
* `npm run generate:dispatchers`: Triggers the custom `ts-morph` script to generate the WebSocket `switch/case` routing logic for both the external Node.js WS server and the UXP plugin receiver.
* `npm run generate:client`: Triggers `Kubb` inside the `/sample-client` to ingest the `openapi.json` and generate a fully typed TypeScript client.
* `npm run generate:all`: Executes all the above steps sequentially.

## 7. Testing Strategy
* **Integration Tests Only:** Unit tests are explicitly excluded. Testing focuses entirely on end-to-end integration.
* **Execution:** Tests will run against an active containerized Node.js server and an active native Premiere Pro instance loaded with pre-configured `.prproj` (Premiere Project) test files. This will be added manually.
* **Methodology:** The test suite will utilize the auto-generated `Kubb` client to issue real commands through the entire pipeline (REST/WS -> Server -> UXP Bridge -> Premiere DOM) and assert the actual state changes or successful response payloads.

## 8. Implementation Instructions for AI Agents
**Objective:** Scaffold and implement the Premiere Remote UXP architecture based on the specifications above.

**Step 1: Workspace & Container Initialization**
* Set up a TypeScript monorepo with top-level directories: `server`, `plugin`, and `sample-client`.
* Establish `.devcontainer` configuration mapped to support both `/server` and `/sample-client`.
* Create production `Dockerfile`s for both `/server` and `/sample-client`.
* Establish the granular and master generation scripts in the root `package.json`.

**Step 2: Define the SSOT & Northbound APIs (`/server`)**
* Implement TypeScript classes using `tsoa` decorators (`@Get`, `@Post`, `@Route`).
* Include a `HealthController` for the REST `GET /health` endpoint.
* Ensure running `generate:api` successfully creates the Express routes and OpenAPI spec.
* Set up the MCP Server functionality based on the generated OpenAPI spec.

**Step 3: Develop the AST Generator (`ts-morph`)**
* Write a Node script that parses the `tsoa` controller files.
* Generate the `switch/case` logic for the External WebSocket.
* Generate the boilerplate `switch/case` receiver logic for the `/plugin`.

**Step 4: Setup the Gateway & Bridges (`/server`)**
* Attach two separate `ws` instances to the raw HTTP Express server via the `upgrade` event.
* Route `/api/ws` to the generated external dispatcher. Route `/uxp-bridge` to an internal connection manager.
* Ensure controllers broadcast execution requests to the internal UXP connection manager and await the response.

**Step 5: Implement UXP Client Logic (`/plugin`)**
* Establish an outbound WebSocket connection (`new WebSocket('ws://localhost:PORT/uxp-bridge')`) on startup.
* Import the auto-generated receiver logic from Step 3. Fill in the actual Adobe UXP DOM API calls inside the placeholders.

**Step 6: CLI Sample Client & Integration Tests (`/sample-client`)**
* Configure `Kubb` to consume the backend's OpenAPI spec and generate the TS client (`generate:client`).
* Implement a robust CLI application (e.g., using a library like Commander or Yargs) that parses command-line arguments to trigger the generated Kubb client methods.
* Write the end-to-end integration test suite using this same client to interact with the pre-configured Premiere `.prproj` files. Ensure these tests can run against the Dockerized server.

## 9. Files
The previous project using CEP is located in `_old`. The types.d.ts file is located in the root.