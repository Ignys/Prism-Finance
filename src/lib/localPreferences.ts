import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

const LOCAL_PREFERENCES_VERSION = 1;

interface LocalPreferencesRecord {
    version: number;
    sections: Record<string, unknown>;
}

export interface LocalPreferenceReadResult<T> {
    exists: boolean;
    value: T;
}

type LocalPreferenceNormalizer<T> = (value: unknown) => T;

function getLocalPreferencesStorageKey(userId: string | null | undefined): string {
    const ownerId = userId?.trim() || "anonymous";
    return `prism.local-preferences.v${LOCAL_PREFERENCES_VERSION}.${ownerId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLocalPreferencesRecord(userId: string | null | undefined): LocalPreferencesRecord {
    if (typeof window === "undefined" || !window.localStorage) {
        return { version: LOCAL_PREFERENCES_VERSION, sections: {} };
    }

    try {
        const raw = window.localStorage.getItem(getLocalPreferencesStorageKey(userId));
        if (!raw) {
            return { version: LOCAL_PREFERENCES_VERSION, sections: {} };
        }

        const parsed = JSON.parse(raw);
        if (!isRecord(parsed) || !isRecord(parsed.sections)) {
            return { version: LOCAL_PREFERENCES_VERSION, sections: {} };
        }

        return {
            version: LOCAL_PREFERENCES_VERSION,
            sections: parsed.sections,
        };
    } catch {
        return { version: LOCAL_PREFERENCES_VERSION, sections: {} };
    }
}

function writeLocalPreferencesRecord(userId: string | null | undefined, record: LocalPreferencesRecord): void {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.setItem(
            getLocalPreferencesStorageKey(userId),
            JSON.stringify({
                version: LOCAL_PREFERENCES_VERSION,
                sections: record.sections,
            }),
        );
    } catch (error) {
        console.error("Failed to write local preferences:", error);
    }
}

export function readLocalPreferenceSection<T>(
    userId: string | null | undefined,
    section: string,
    fallback: T,
    normalize: LocalPreferenceNormalizer<T> = (value) => value as T,
): LocalPreferenceReadResult<T> {
    const record = readLocalPreferencesRecord(userId);
    if (!Object.prototype.hasOwnProperty.call(record.sections, section)) {
        return {
            exists: false,
            value: fallback,
        };
    }

    return {
        exists: true,
        value: normalize(record.sections[section]),
    };
}

export function writeLocalPreferenceSection<T>(userId: string | null | undefined, section: string, value: T): void {
    const record = readLocalPreferencesRecord(userId);
    writeLocalPreferencesRecord(userId, {
        ...record,
        sections: {
            ...record.sections,
            [section]: value,
        },
    });
}

export function useLocalPreferenceSection<T>(
    userId: string | null | undefined,
    section: string,
    fallback: T,
    normalize: LocalPreferenceNormalizer<T> = (value) => value as T,
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => readLocalPreferenceSection(userId, section, fallback, normalize).value);

    useEffect(() => {
        setValue(readLocalPreferenceSection(userId, section, fallback, normalize).value);
    }, [fallback, normalize, section, userId]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const storageKey = getLocalPreferencesStorageKey(userId);
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== storageKey) {
                return;
            }

            setValue(readLocalPreferenceSection(userId, section, fallback, normalize).value);
        };

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [fallback, normalize, section, userId]);

    const setLocalPreferenceValue = useCallback<Dispatch<SetStateAction<T>>>(
        (nextValueAction) => {
            setValue((currentValue) => {
                const nextValue = typeof nextValueAction === "function" ? (nextValueAction as (current: T) => T)(currentValue) : nextValueAction;
                const normalizedValue = normalize(nextValue);
                writeLocalPreferenceSection(userId, section, normalizedValue);
                return normalizedValue;
            });
        },
        [normalize, section, userId],
    );

    return [value, setLocalPreferenceValue];
}
