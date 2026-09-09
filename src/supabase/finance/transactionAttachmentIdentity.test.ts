import { describe, expect, it } from "vitest";
import { createTransactionAttachmentId } from "./transactionAttachmentIdentity";

describe("transaction attachment identity", () => {
    it("is stable for retries and changes with file content", async () => {
        const first = new File(["receipt"], "receipt.pdf", { type: "application/pdf", lastModified: 123 });
        const retry = new File(["receipt"], "receipt.pdf", { type: "application/pdf", lastModified: 123 });
        const changed = new File(["different"], "receipt.pdf", { type: "application/pdf", lastModified: 123 });

        expect(await createTransactionAttachmentId("transaction-a", first)).toBe(await createTransactionAttachmentId("transaction-a", retry));
        expect(await createTransactionAttachmentId("transaction-a", changed)).not.toBe(await createTransactionAttachmentId("transaction-a", first));
        expect(await createTransactionAttachmentId("transaction-b", first)).not.toBe(await createTransactionAttachmentId("transaction-a", first));
    });
});
