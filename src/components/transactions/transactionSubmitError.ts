export function getTransactionSubmitErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }
    return "Nao foi possivel salvar a transacao.";
}
