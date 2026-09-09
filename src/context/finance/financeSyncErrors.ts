const domainErrors = [
    ["INVOICE_OVERPAYMENT", "A fatura recebeu pagamentos concorrentes acima do saldo aberto. Revise as alterações locais antes de sincronizar; os dados foram preservados."],
    ["RECURRENCE_ROUTING_REFERENCE_INVALID", "Uma série aponta para uma carteira ou cartão indisponível. Revise a série para sincronizar; os dados locais foram preservados."],
    ["RECURRENCE_TAG_REFERENCE_INVALID", "Uma série aponta para uma tag indisponível. Revise a série para sincronizar; os dados locais foram preservados."],
    ["RECURRENCE_OCCURRENCE_OUTSIDE_RULE", "Esta ocorrência está fora da série atual, possivelmente encerrada em outro dispositivo. A alteração local foi preservada e precisa ser revisada."],
    ["PAID_INVOICE_CHARGE_IMMUTABLE", "A fatura recebeu um pagamento. Revise a alteração local antes de sincronizar."],
    ["PAID_INVOICE_REQUIRES_PAYMENT_REVERSAL", "A alteração exige reverter o pagamento da fatura. Os dados locais foram preservados."],
    ["INVALID_RECURRENCE_RULE", "A regra recorrente contém dados inválidos. Corrija a série para sincronizar."],
] as const;

export function describeFinanceSyncError(error: unknown): { message: string; retryAutomatically: boolean } {
    const message = error instanceof Error ? error.message : "Não foi possível sincronizar com o banco de dados.";
    const domainError = domainErrors.find(([code]) => message.includes(code));
    return domainError
        ? { message: domainError[1], retryAutomatically: false }
        : { message, retryAutomatically: true };
}
