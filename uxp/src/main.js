// PremiereRemote — panel logic
// Call counters (will be driven by WS/HTTP/MCP events)
const counts = { ws: 0, http: 0, mcp: 0 };

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "") + "K";
  return String(n);
}

function updateCount(source) {
  counts[source]++;
  const el = document.getElementById("count-" + source);
  if (el) el.textContent = formatCount(counts[source]);
}

function setLastCommand(name, source) {
  const nameEl = document.getElementById("last-command-name");
  const srcEl  = document.getElementById("last-command-source");
  if (nameEl) nameEl.textContent = name;
  if (srcEl) {
    srcEl.textContent = source.toUpperCase();
    srcEl.className = "badge badge--" + source.toLowerCase();
  }
}

function setStatus(state, message) {
  // state: "ok" | "warn" | "error"
  const dot  = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  if (dot)  dot.className = "status-dot status-dot--" + state;
  if (text) text.textContent = message;
}

// TODO: connect WebSocket to ws://localhost:3000/uxp-bridge and wire events
