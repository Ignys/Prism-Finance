import type { SupabaseFinanceData } from "../../supabase/finance";

const CHANNEL_NAME = "prism.finance.cross-tab";
const MESSAGE_VERSION = 1;

export interface FinanceCrossTabSnapshotMessage {
    kind: "finance-snapshot";
    version: typeof MESSAGE_VERSION;
    id: string;
    sourceId: string;
    userId: string;
    sentAt: string;
    data: SupabaseFinanceData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function createMessageId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `finance-sync-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getTabSourceId(): string {
    if (typeof window === "undefined" || !window.sessionStorage) {
        return createMessageId();
    }

    const storageKey = "prism.finance.tab-id";
    const existingId = window.sessionStorage.getItem(storageKey);
    if (existingId) {
        return existingId;
    }

    const nextId = createMessageId();
    window.sessionStorage.setItem(storageKey, nextId);
    return nextId;
}

function getSnapshotStorageKey(userId: string): string {
    return `prism.finance.cross-tab.snapshot.${userId}`;
}

function parseSnapshotMessage(raw: unknown, userId: string): FinanceCrossTabSnapshotMessage | null {
    if (
        !isRecord(raw) ||
        raw.kind !== "finance-snapshot" ||
        raw.version !== MESSAGE_VERSION ||
        raw.userId !== userId ||
        typeof raw.id !== "string" ||
        typeof raw.sourceId !== "string" ||
        typeof raw.sentAt !== "string" ||
        !isRecord(raw.data)
    ) {
        return null;
    }

    return raw as unknown as FinanceCrossTabSnapshotMessage;
}

export function publishFinanceSnapshotToTabs(userId: string, data: SupabaseFinanceData): FinanceCrossTabSnapshotMessage {
    const message: FinanceCrossTabSnapshotMessage = {
        kind: "finance-snapshot",
        version: MESSAGE_VERSION,
        id: createMessageId(),
        sourceId: getTabSourceId(),
        userId,
        sentAt: new Date().toISOString(),
        data,
    };

    if (typeof window === "undefined") {
        return message;
    }

    try {
        const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
        channel?.postMessage(message);
        channel?.close();
    } catch (error) {
        console.error("Failed to broadcast finance snapshot:", error);
    }

    try {
        window.localStorage?.setItem(getSnapshotStorageKey(userId), JSON.stringify(message));
    } catch (error) {
        console.error("Failed to persist cross-tab finance snapshot:", error);
    }

    return message;
}

export function subscribeToFinanceSnapshotMessages(
    userId: string,
    onMessage: (message: FinanceCrossTabSnapshotMessage) => void,
): () => void {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    const sourceId = getTabSourceId();
    const seenMessageIds = new Set<string>();

    const handleMessage = (raw: unknown) => {
        const message = parseSnapshotMessage(raw, userId);
        if (!message || message.sourceId === sourceId || seenMessageIds.has(message.id)) {
            return;
        }

        seenMessageIds.add(message.id);
        onMessage(message);
    };

    const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    channel?.addEventListener("message", (event) => handleMessage(event.data));

    const handleStorage = (event: StorageEvent) => {
        if (event.key !== getSnapshotStorageKey(userId) || !event.newValue) {
            return;
        }

        try {
            handleMessage(JSON.parse(event.newValue));
        } catch {
            return;
        }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
        channel?.close();
        window.removeEventListener("storage", handleStorage);
    };
}
