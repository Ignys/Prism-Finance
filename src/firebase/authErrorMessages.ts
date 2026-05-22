export function resolveAuthErrorMessage(error: unknown, fallbackMessage = "Nao foi possivel concluir a operacao. Tente novamente."): string {
    if (!error || typeof error !== "object" || !("code" in error)) {
        return fallbackMessage;
    }

    const code = (error as { code?: unknown }).code;
    if (typeof code !== "string") {
        return fallbackMessage;
    }

    const errorByCode: Record<string, string> = {
        "auth/account-exists-with-different-credential": "Ja existe conta com este e-mail em outro metodo de login.",
        "auth/email-already-in-use": "Ja existe uma conta com esse e-mail.",
        "auth/invalid-credential": "Credenciais invalidas. Revise os dados e tente novamente.",
        "auth/invalid-email": "Digite um e-mail valido.",
        "auth/missing-password": "Digite sua senha.",
        "auth/network-request-failed": "Falha de conexao. Confira sua internet e tente novamente.",
        "auth/popup-blocked": "Pop-up bloqueado pelo navegador. Permita pop-ups e tente novamente.",
        "auth/popup-closed-by-user": "O login com Google foi cancelado.",
        "auth/requires-recent-login": "Por seguranca, entre novamente na conta antes de alterar este dado.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        "auth/user-not-found": "Nenhuma conta encontrada para esse e-mail.",
        "auth/weak-password": "A nova senha precisa ter no minimo 6 caracteres.",
        "auth/wrong-password": "Senha atual incorreta.",
    };

    return errorByCode[code] ?? fallbackMessage;
}
