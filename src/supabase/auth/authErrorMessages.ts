function readMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "object" && error !== null && "message" in error) {
        const message = (error as { message?: unknown }).message;
        return typeof message === "string" ? message : "";
    }

    return "";
}

export function resolveSupabaseAuthErrorMessage(error: unknown, fallback: string): string {
    const message = readMessage(error).toLowerCase();

    if (message.includes("invalid login credentials")) {
        return "E-mail ou senha incorretos.";
    }

    if (message.includes("email not confirmed")) {
        return "Confirme seu e-mail antes de entrar.";
    }

    if (message.includes("user already registered") || message.includes("already registered")) {
        return "Este e-mail ja esta cadastrado.";
    }

    if (message.includes("password should be at least")) {
        return "A senha precisa ter no minimo 6 caracteres.";
    }

    if (message.includes("signup is disabled")) {
        return "Cadastro desabilitado no Supabase.";
    }

    return fallback;
}
