const counts: Record<string, number> = { ws: 0, http: 0, mcp: 0 };

function formatCount(n: number): string {
    if (n >= 1000)
        return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "") + "K";
    return String(n);
}

export function updateCount(source: string): void {
    counts[source]++;
    const el = document.getElementById("count-" + source);
    if (el) el.textContent = formatCount(counts[source]);
}

export function setLastCommand(name: string, source: string): void {
    const nameEl = document.getElementById("last-command-name");
    const srcEl = document.getElementById("last-command-source");
    if (nameEl) nameEl.textContent = name;
    if (srcEl) {
        srcEl.textContent = source.toUpperCase();
        srcEl.className = "badge badge--" + source.toLowerCase();
    }
}

export function setStatus(
    state: "ok" | "warn" | "error",
    message: string,
): void {
    const dot = document.getElementById("status-dot");
    const text = document.getElementById("status-text");
    if (dot) dot.className = "status-dot status-dot--" + state;
    if (text) text.textContent = message;
}
