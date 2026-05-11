export type SourceType = "ws" | "http" | "mcp";
export type StatusState = "ok" | "warn" | "error";
const counts: Record<SourceType, number> = { ws: 0, http: 0, mcp: 0 };

function formatCount(n: number): string {
    if (n >= 1000)
        return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "") + "K";
    return String(n);
}

function setCount(source: SourceType, count: number): void {
    counts[source] = count;
    const countElement = document.getElementById("count-" + source);
    if (countElement) countElement.textContent = formatCount(counts[source]);
}

export function increaseCount(source: SourceType): void {
    counts[source]++;
    const countElement = document.getElementById("count-" + source);
    if (countElement) countElement.textContent = formatCount(counts[source]);
}

export function setLastCommand(name: string, source: SourceType): void {
    const nameElement = document.getElementById("last-command-name");
    const sourceElement = document.getElementById("last-command-source");
    if (nameElement) nameElement.textContent = name;
    if (sourceElement) {
        sourceElement.textContent = source.toUpperCase();
        sourceElement.className = "badge badge-" + source.toLowerCase();
    }
}

export function setStatus(
    state: StatusState,
    message: string,
    detail?: string,
): void {
    const dot = document.getElementById("status-dot");
    const text = document.getElementById("status-text");
    const icon = document.getElementById("status-info-icon");
    if (dot) dot.className = "status-dot status-dot-" + state;
    if (text) text.textContent = message;
    if (icon) icon.setAttribute("title", detail || "");
}

export function resetUI(): void {
    for (const source of Object.keys(counts) as SourceType[]) {
        setCount(source, 0);
    }
    setLastCommand("-", "http");
    setStatus(
        "warn",
        "Initializing...",
        "PremiereRemote is initializing. Please wait a moment...",
    );
}
