import type { SupabaseFinanceLoadResult } from "../../supabase/finance";

interface RecoverySteps {
    load: () => Promise<SupabaseFinanceLoadResult>;
    backup: () => Promise<void>;
    removePending: () => Promise<void>;
    isCurrent: () => boolean;
    publish: (remote: SupabaseFinanceLoadResult) => void;
}

/** Explicit recovery never drops pending work before its backup is durable. */
export async function recoverPendingSync(steps: RecoverySteps): Promise<void> {
    const assertCurrent = () => {
        if (!steps.isCurrent()) throw new Error("Os dados locais mudaram. Revise as alterações e tente novamente.");
    };
    const remote = await steps.load();
    if (!remote.data) throw new Error("Não foi possível carregar os dados confirmados. As alterações locais foram mantidas.");
    assertCurrent();
    await steps.backup();
    assertCurrent();
    await steps.removePending();
    assertCurrent();
    steps.publish(remote);
}
