/** Stable across retries of the same selected file, so partial uploads can resume safely. */
export async function createTransactionAttachmentId(transactionId: string, file: File): Promise<string> {
    const metadata = new TextEncoder().encode(`${transactionId}\0${file.name}\0${file.type}\0${file.size}\0${file.lastModified}\0`);
    const contents = new Uint8Array(await file.arrayBuffer());
    const payload = new Uint8Array(metadata.byteLength + contents.byteLength);
    payload.set(metadata);
    payload.set(contents, metadata.byteLength);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
    const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `attachment-${hex}`;
}
