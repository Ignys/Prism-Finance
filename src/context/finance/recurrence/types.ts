export type RecurrenceEnd = { type: "never" } | { type: "count"; count: number } | { type: "until"; date: string };

/** One monthly engine for both fixed and finite repeated payments. Amount is per occurrence. */
export interface RecurrenceRule {
    /** Rule segments share a series identity and global occurrence ordinals. */
    seriesId?: string;
    startNumber?: number;
    stopNumber?: number;
    frequency: "monthly";
    interval: number;
    anchorDate: string;
    amount: number;
    end: RecurrenceEnd;
    tagIds: string[];
    excludedDates: string[];
    notes: string | null;
    sourceWalletId?: string | null;
    destinationWalletId?: string | null;
    creditCardId?: string | null;
}

export interface OccurrencePeriod {
    startDate: string;
    endDate: string;
}
