const CHANNEL_NAME = "prism.finance.cross-tab";
const MESSAGE_VERSION = 2;

export interface FinanceCrossTabRevisionMessage {
    kind: "finance-revision";
    version: typeof MESSAGE_VERSION;
    id: string;
    sourceId: string;
    userId: string;
    sentAt: string;
    revision: number;
    updatedBy: string | null;
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

export function getFinanceClientId(): string {
    if (typeof window === "undefined" || !window.sessionStorage) {
        return createMessageId();
    }

    const storageKey = "prism.finance.client-id";
    const existingId = window.sessionStorage.getItem(storageKey);
    if (existingId) {
        return existingId;
    }

    const nextId = createMessageId();
    window.sessionStorage.setItem(storageKey, nextId);
    return nextId;
}

function getRevisionStorageKey(userId: string): string {
    return `prism.finance.cross-tab.revision.${userId}`;
}

function parseRevisionMessage(raw: unknown, userId: string): FinanceCrossTabRevisionMessage | null {
    if (
        !isRecord(raw) ||
        raw.kind !== "finance-revision" ||
        raw.version !== MESSAGE_VERSION ||
        raw.userId !== userId ||
        typeof raw.id !== "string" ||
        typeof raw.sourceId !== "string" ||
        typeof raw.sentAt !== "string" ||
        typeof raw.revision !== "number"
    ) {
        return null;
    }

    return {
        ...(raw as unknown as FinanceCrossTabRevisionMessage),
        updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
    };
}

export function publishFinanceRevisionToTabs(userId: string, revision: number, updatedBy: string | null): FinanceCrossTabRevisionMessage {
    const message: FinanceCrossTabRevisionMessage = {
        kind: "finance-revision",
        version: MESSAGE_VERSION,
        id: createMessageId(),
        sourceId: getFinanceClientId(),
        userId,
        sentAt: new Date().toISOString(),
        revision,
        updatedBy,
    };

    if (typeof window === "undefined") {
        return message;
    }

    try {
        const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
        channel?.postMessage(message);
        channel?.close();
    } catch (error) {
        console.error("Failed to broadcast finance revision:", error);
    }

    try {
        window.localStorage?.setItem(getRevisionStorageKey(userId), JSON.stringify(message));
    } catch (error) {
        console.error("Failed to persist cross-tab finance revision:", error);
    }

    return message;
}

export function subscribeToFinanceRevisionMessages(userId: string, onMessage: (message: FinanceCrossTabRevisionMessage) => void): () => void {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    const sourceId = getFinanceClientId();
    const seenMessageIds = new Set<string>();

    const handleMessage = (raw: unknown) => {
        const message = parseRevisionMessage(raw, userId);
        if (!message || message.sourceId === sourceId || seenMessageIds.has(message.id)) {
            return;
        }

        seenMessageIds.add(message.id);
        onMessage(message);
    };

    const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    channel?.addEventListener("message", (event) => handleMessage(event.data));

    const handleStorage = (event: StorageEvent) => {
        if (event.key !== getRevisionStorageKey(userId) || !event.newValue) {
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
