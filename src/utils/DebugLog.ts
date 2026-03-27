export type DebugLogEntry = {
    ts: number;
    type: string;
    detail?: Record<string, unknown>;
};

const STORAGE_KEY = "barbie-storybook-debug-log";
const MAX_LOG_ENTRIES = 300;

declare global {
    interface Window {
        __barbieDebugLog?: {
            get: typeof getDebugLogs;
            clear: typeof clearDebugLogs;
            export: typeof exportDebugLogs;
        };
    }
}

function readEntries(): DebugLogEntry[] {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as DebugLogEntry[];
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}

function writeEntries(entries: DebugLogEntry[]): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_LOG_ENTRIES)));
    }
    catch {
        return;
    }
}

export function logDebug(type: string, detail?: Record<string, unknown>): void {
    const entry: DebugLogEntry = {
        ts: Date.now(),
        type,
        detail,
    };
    const entries = readEntries();
    entries.push(entry);
    writeEntries(entries);
    console.log("[barbie-log]", type, detail ?? {});
}

export function getDebugLogs(): DebugLogEntry[] {
    return readEntries();
}

export function clearDebugLogs(): void {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    }
    catch {
        return;
    }
}

export function exportDebugLogs(): void {
    const payload = {
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        logs: readEntries(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `barbie-storybook-logs-${Date.now()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function installDebugLogBridge(): void {
    window.__barbieDebugLog = {
        get: getDebugLogs,
        clear: clearDebugLogs,
        export: exportDebugLogs,
    };
}
