export interface TransactionAttachment {
    id: string;
    transactionId: string;
    fileName: string;
    storagePath: string;
    mimeType: string | null;
    sizeBytes: number;
    createdAt: string;
}

export interface TransactionDetails {
    annotation: string;
    attachments: TransactionAttachment[];
}
