import { doc, onSnapshot } from "firebase/firestore";
import { Copy, Info, Link2, ShieldUser, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFinanceActions, useFinanceFamily, useFinanceSession, type FamilyMember } from "../../../context/FinanceContext";
import { db } from "../../../firebase/firebaseClient";
import { resolveUserDisplayName } from "../../../lib/userProfile";
import { BeneficiaryAvatar } from "../../common/BeneficiaryAvatar";

type FamilyMemberPhotoMap = Record<string, string | null>;

function asOptionalTrimmedString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveMemberPhotoUrl(value: unknown): string | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const profile = "profile" in value && typeof value.profile === "object" && value.profile !== null ? (value.profile as Record<string, unknown>) : null;
    return asOptionalTrimmedString(profile?.photoURL);
}

function useFamilyMemberPhotoUrls(members: FamilyMember[]): FamilyMemberPhotoMap {
    const [memberPhotoUrls, setMemberPhotoUrls] = useState<FamilyMemberPhotoMap>({});

    useEffect(() => {
        if (members.length === 0) {
            setMemberPhotoUrls({});
            return;
        }

        const memberUids = members.map((member) => member.uid);
        setMemberPhotoUrls((current) => {
            const nextState = Object.fromEntries(memberUids.map((uid) => [uid, current[uid] ?? null] as const));
            const hasSameEntries =
                Object.keys(current).length === memberUids.length &&
                memberUids.every((uid) => Object.prototype.hasOwnProperty.call(current, uid) && current[uid] === nextState[uid]);

            return hasSameEntries ? current : nextState;
        });

        const unsubscribers = members.map((member) =>
            onSnapshot(
                doc(db, "users", member.uid),
                (snapshot) => {
                    const nextPhotoUrl = snapshot.exists() ? resolveMemberPhotoUrl(snapshot.data()) : null;
                    setMemberPhotoUrls((current) => (current[member.uid] === nextPhotoUrl ? current : { ...current, [member.uid]: nextPhotoUrl }));
                },
                () => {
                    setMemberPhotoUrls((current) => (current[member.uid] === null ? current : { ...current, [member.uid]: null }));
                },
            ),
        );

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [members]);

    return memberPhotoUrls;
}

function resolveFamilyErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return "Nao foi possivel concluir a operacao agora.";
}

export function FamilySettingsTab() {
    const { user } = useFinanceSession();
    const family = useFinanceFamily();
    const { createFamily, generateFamilyInvite, joinFamilyByCode, removeFamilyMember } = useFinanceActions();
    const [familyName, setFamilyName] = useState("");
    const [inviteCodeInput, setInviteCodeInput] = useState("");
    const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
    const [isCreatingFamily, setIsCreatingFamily] = useState(false);
    const [isJoiningFamily, setIsJoiningFamily] = useState(false);
    const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
    const [removingMemberUid, setRemovingMemberUid] = useState<string | null>(null);
    const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

    const isAdmin = family?.currentUserRole === "admin";
    const activeMembers = useMemo(() => family?.members.filter((member) => member.status === "active") ?? [], [family?.members]);
    const pendingInvites = useMemo(() => family?.invites.filter((invite) => invite.status === "pending") ?? [], [family?.invites]);
    const memberPhotoUrls = useFamilyMemberPhotoUrls(activeMembers);
    const userName = resolveUserDisplayName(user);
    const canCreateOrJoin = !family;

    const handleCreateFamily = async () => {
        if (isCreatingFamily) {
            return;
        }

        setFeedback(null);
        setIsCreatingFamily(true);
        try {
            await createFamily(familyName.trim() || `Familia de ${userName}`);
            setFamilyName("");
            setFeedback({
                type: "success",
                message: "Familia criada com sucesso. Agora voce ja pode gerar convites.",
            });
        } catch (error) {
            setFeedback({
                type: "error",
                message: resolveFamilyErrorMessage(error),
            });
        } finally {
            setIsCreatingFamily(false);
        }
    };

    const handleJoinFamily = async () => {
        if (!inviteCodeInput.trim() || isJoiningFamily) {
            return;
        }

        setFeedback(null);
        setIsJoiningFamily(true);
        try {
            await joinFamilyByCode(inviteCodeInput);
            setInviteCodeInput("");
            setFeedback({
                type: "success",
                message: "Convite aceito. A wishlist da familia ja foi conectada a sua conta.",
            });
        } catch (error) {
            setFeedback({
                type: "error",
                message: resolveFamilyErrorMessage(error),
            });
        } finally {
            setIsJoiningFamily(false);
        }
    };

    const handleGenerateInvite = async () => {
        if (!family?.id || isGeneratingInvite) {
            return;
        }

        setFeedback(null);
        setIsGeneratingInvite(true);
        try {
            const invite = await generateFamilyInvite();
            setCopiedInviteId(invite.inviteId);
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(invite.code);
            }
            setFeedback({
                type: "success",
                message: "Novo codigo gerado. Ele foi copiado para a area de transferencia quando disponivel.",
            });
        } catch (error) {
            setFeedback({
                type: "error",
                message: resolveFamilyErrorMessage(error),
            });
        } finally {
            setIsGeneratingInvite(false);
        }
    };

    const handleCopyInvite = async (inviteId: string, code: string) => {
        try {
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(code);
            }
            setCopiedInviteId(inviteId);
            setFeedback({
                type: "success",
                message: "Codigo copiado com sucesso.",
            });
        } catch {
            setFeedback({
                type: "error",
                message: "Nao foi possivel copiar o codigo automaticamente.",
            });
        }
    };

    const handleRemoveMember = async (memberUid: string, memberName: string) => {
        if (!family?.id || removingMemberUid) {
            return;
        }

        const shouldRemove = window.confirm(`Remover ${memberName} da familia?`);
        if (!shouldRemove) {
            return;
        }

        setFeedback(null);
        setRemovingMemberUid(memberUid);
        try {
            await removeFamilyMember(memberUid);
            setFeedback({
                type: "success",
                message: `${memberName} foi removido da familia.`,
            });
        } catch (error) {
            setFeedback({
                type: "error",
                message: resolveFamilyErrorMessage(error),
            });
        } finally {
            setRemovingMemberUid(null);
        }
    };

    return (
        <section>
            <article>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/55">SUA Familia</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">{family ? family.name : "Conecte contas para compartilhar desejos"}</h2>
                    </div>
                </div>
            </article>

            {feedback ? (
                <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                        feedback.type === "success" ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100" : "border-red-400/25 bg-red-500/10 text-red-100"
                    }`}
                >
                    {feedback.message}
                </div>
            ) : null}

            {!family ? (
                <section className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                    <article className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-5">
                        <h3 className="text-lg font-semibold text-white">Criar nova familia</h3>
                        <p className="mt-1 text-sm text-white/45">Voce se torna o admin do grupo e pode convidar ate quatro pessoas.</p>

                        <label className="mt-5 flex flex-col gap-2 text-sm text-white/70">
                            Nome da familia
                            <input
                                type="text"
                                value={familyName}
                                onChange={(event) => setFamilyName(event.target.value)}
                                placeholder={`Familia de ${userName}`}
                                disabled={!canCreateOrJoin || isCreatingFamily}
                                className="rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.22]"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => void handleCreateFamily()}
                            disabled={!canCreateOrJoin || isCreatingFamily}
                            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/12 px-4 py-3 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/16 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Users size={16} />
                            {isCreatingFamily ? "Criando..." : "Criar familia"}
                        </button>
                    </article>

                    <article className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-5">
                        <h3 className="text-lg font-semibold text-white">Entrar com convite</h3>
                        <p className="mt-1 text-sm text-white/45">Cole um codigo manual compartilhado pelo admin da familia.</p>

                        <label className="mt-5 flex flex-col gap-2 text-sm text-white/70">
                            Codigo do convite
                            <input
                                type="text"
                                value={inviteCodeInput}
                                onChange={(event) => setInviteCodeInput(event.target.value)}
                                placeholder="Insira o codigo aqui"
                                disabled={!canCreateOrJoin || isJoiningFamily}
                                className="rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.22]"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => void handleJoinFamily()}
                            disabled={!canCreateOrJoin || !inviteCodeInput.trim() || isJoiningFamily}
                            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/16 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Link2 size={16} />
                            {isJoiningFamily ? "Entrando..." : "Aceitar convite"}
                        </button>
                    </article>
                </section>
            ) : (
                <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                    <article className="rounded-lg border border-white/[0.08] bg-[#101010] p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Membros da familia</h3>
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-1">
                                <p className="text-xs font-light text-white/60">
                                    {activeMembers.length} de {family.maxMembers}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            {activeMembers.map((member) => {
                                const isCurrentUser = member.uid === user?.uid;
                                const canRemove = isAdmin && !isCurrentUser && member.role !== "admin";
                                const memberPhotoUrl = memberPhotoUrls[member.uid] ?? null;

                                return (
                                    <div key={member.uid} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <BeneficiaryAvatar
                                                beneficiary={{
                                                    name: member.displayName,
                                                    avatarImage: memberPhotoUrl,
                                                    avatarColor: "#4B5563",
                                                }}
                                                className="h-11 w-11 shrink-0 rounded-full border border-white/[0.12]"
                                                textClassName="text-sm font-semibold text-white"
                                            />
                                            <div className="min-w-0 flex flex-col gap-1">
                                                <p className="truncate text-sm font-medium text-white">
                                                    {member.displayName}
                                                    {isCurrentUser ? " (Eu)" : ""}
                                                </p>
                                                <p className="truncate text-xs text-white/45">{member.email ?? "Email indisponivel"}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {member.role === "admin" ? <ShieldUser className="opacity-60" strokeWidth={1.5} size={26} /> : null}

                                            {canRemove ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleRemoveMember(member.uid, member.displayName)}
                                                    disabled={removingMemberUid === member.uid}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-100 transition-colors hover:bg-red-500/16 disabled:cursor-not-allowed disabled:opacity-60"
                                                    title="Remover membro"
                                                    aria-label={`Remover ${member.displayName}`}
                                                >
                                                    <X size={16} />
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </article>

                    <div className="space-y-4">
                        {isAdmin ? (
                            <article className="rounded-lg border border-white/[0.08] bg-[#101010] p-5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Convites</h3>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => void handleGenerateInvite()}
                                        disabled={isGeneratingInvite || activeMembers.length >= family.maxMembers}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/12 px-5 py-1.5 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/16 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <UserPlus size={16} />
                                        {isGeneratingInvite ? "Gerando..." : "Gerar convite"}
                                    </button>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {pendingInvites.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.03] px-4 py-5 text-sm text-white/45">Nenhum convite pendente no momento.</div>
                                    ) : (
                                        pendingInvites.map((invite) => (
                                            <div key={invite.inviteId} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs uppercase tracking-[0.16em] text-white/35">Codigo ativo</p>
                                                        <p className="mt-2 break-all font-mono text-sm text-white">{invite.code}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleCopyInvite(invite.inviteId, invite.code)}
                                                        className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition-colors hover:text-white"
                                                    >
                                                        <Copy size={15} />
                                                        {copiedInviteId === invite.inviteId ? "Copiado" : "Copiar"}
                                                    </button>
                                                </div>
                                                <p className="mt-3 text-xs text-white/35">{new Date(invite.createdAt).toLocaleString("pt-BR")}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </article>
                        ) : null}

                        <article className="rounded-lg border border-white/[0.08] bg-[#101010] p-5">
                            <h3 className="inline-flex items-center gap-1.5 text-lg font-semibold text-white">
                                <Info size={20} /> Escopo compartilhado
                            </h3>
                            <p className="mt-1 text-sm text-white/45">
                                Atualmente, os membros da familia enxergam apenas a wishlist. Carteiras, cartoes, transacoes e planejamento continuam privados.
                            </p>
                        </article>
                    </div>
                </section>
            )}
        </section>
    );
}
