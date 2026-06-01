import { Bell, ImagePlus, KeyRound, LogOut, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useFinanceSession } from "../../../context/FinanceContext";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from "firebase/auth";
import { resolveUserDisplayName } from "../../../lib/userProfile";
import { resolveAuthErrorMessage } from "../../../firebase/authErrorMessages";
import { syncUserProfileEverywhere } from "../../../firebase/familyService";
import { dispatchAuthProfileUpdated } from "../../../lib/authProfileEvents";
import { uploadAvatarToCloudinary } from "../../../lib/cloudinary";
import { auth } from "../../../firebase/firebaseClient";

type AccountSettingsTabProps = {
    emailAlertsEnabled: boolean;
    focusModeEnabled: boolean;
    monthlySummaryEnabled: boolean;
    onEmailAlertsChange: (nextValue: boolean) => void;
    onFocusModeChange: (nextValue: boolean) => void;
    onMonthlySummaryChange: (nextValue: boolean) => void;
    onOpenRegistry: () => void;
    onOpenTransactions: () => void;
    onOpenWishlist: () => void;
    onSignOut: () => void | Promise<void>;
};

type SettingToggleProps = {
    label: string;
    description: string;
    value: boolean;
    onChange: (nextValue: boolean) => void;
};

function SettingToggle({ label, description, value, onChange }: SettingToggleProps) {
    return (
        <button
            type="button"
            onClick={() => onChange(!value)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
        >
            <div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="mt-1 text-sm text-white/45">{description}</p>
            </div>
            <span
                className={`relative inline-flex h-7 w-12 rounded-full border transition-colors ${value ? "border-emerald-300/40 bg-emerald-400/30" : "border-white/[0.1] bg-white/[0.05]"}`}
                aria-hidden="true"
            >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
            </span>
        </button>
    );
}

export function AccountSettingsTab({
    emailAlertsEnabled,
    focusModeEnabled,
    monthlySummaryEnabled,
    onEmailAlertsChange,
    onFocusModeChange,
    onMonthlySummaryChange,
    onOpenRegistry,
    onOpenTransactions,
    onOpenWishlist,
    onSignOut,
}: AccountSettingsTabProps) {
    const { user, profile } = useFinanceSession();
    const userName = profile?.displayName ?? resolveUserDisplayName(user);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [displayName, setDisplayName] = useState(userName);
    const previewObjectUrlRef = useRef<string | null>(null);
    const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
    const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState<string | null>(null);
    const [photoMode, setPhotoMode] = useState<"keep" | "replace" | "remove">("keep");
    const [profileError, setProfileError] = useState("");
    const [profileSuccess, setProfileSuccess] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    const userInitial = userName.charAt(0).toUpperCase();
    const userPhotoUrl = profile ? profile.photoURL : user?.photoURL?.trim() ? user.photoURL : null;
    const previewPhotoUrl = photoMode === "remove" ? null : (selectedPhotoPreviewUrl ?? userPhotoUrl);
    const supportsPasswordChange = useMemo(() => user?.providerData.some((provider) => provider.providerId === "password") ?? false, [user]);
    const hasPersistedPhoto = Boolean(userPhotoUrl);
    const hasSelectedPhoto = Boolean(selectedPhotoFile && selectedPhotoPreviewUrl);
    const isMarkedForRemoval = photoMode === "remove" && (hasPersistedPhoto || hasSelectedPhoto);
    const createdAtLabel = user?.metadata.creationTime
        ? new Date(user.metadata.creationTime).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
          })
        : "Data indisponivel";

    function clearSelectedPhotoPreview() {
        if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current);
            previewObjectUrlRef.current = null;
        }

        setSelectedPhotoFile(null);
        setSelectedPhotoPreviewUrl(null);
    }

    function handleKeepCurrentPhoto() {
        clearSelectedPhotoPreview();
        setPhotoMode("keep");
        setProfileError("");
        setProfileSuccess("");
    }

    function handleRemovePhoto() {
        if (!hasPersistedPhoto && !hasSelectedPhoto) {
            setProfileError("Sua conta ja esta sem foto.");
            setProfileSuccess("");
            return;
        }

        clearSelectedPhotoPreview();
        setPhotoMode("remove");
        setProfileError("");
        setProfileSuccess("");
    }

    useEffect(() => {
        setDisplayName(userName);
        clearSelectedPhotoPreview();
        setPhotoMode("keep");
    }, [userName, userPhotoUrl]);

    useEffect(() => {
        return () => {
            if (previewObjectUrlRef.current) {
                URL.revokeObjectURL(previewObjectUrlRef.current);
            }
        };
    }, []);

    function handlePhotoFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            setProfileError("Selecione um arquivo de imagem valido.");
            event.target.value = "";
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setProfileError("Use uma imagem com no maximo 2 MB.");
            event.target.value = "";
            return;
        }

        if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current);
        }

        const objectUrl = URL.createObjectURL(file);
        previewObjectUrlRef.current = objectUrl;
        setSelectedPhotoFile(file);
        setSelectedPhotoPreviewUrl(objectUrl);
        setPhotoMode("replace");
        setProfileError("");
        setProfileSuccess("");
        event.target.value = "";
    }

    async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user) {
            return;
        }

        const nextDisplayName = displayName.trim();
        if (!nextDisplayName) {
            setProfileError("Digite um nome de usuario.");
            setProfileSuccess("");
            return;
        }

        setProfileLoading(true);
        setProfileError("");
        setProfileSuccess("");

        try {
            let nextPhotoUrl = userPhotoUrl;
            let nextPhotoPublicId: string | null | undefined = undefined;

            if (photoMode === "replace" && selectedPhotoFile) {
                const uploadResult = await uploadAvatarToCloudinary(selectedPhotoFile, user.uid);
                nextPhotoUrl = uploadResult.secureUrl;
                nextPhotoPublicId = uploadResult.publicId;
            } else if (photoMode === "remove") {
                nextPhotoUrl = null;
                nextPhotoPublicId = null;
            }

            await updateProfile(user, {
                displayName: nextDisplayName,
                photoURL: nextPhotoUrl,
            });
            await user.reload();
            const syncedUser = auth.currentUser ?? user;
            await syncUserProfileEverywhere(syncedUser, {
                displayName: nextDisplayName,
                photoURL: nextPhotoUrl,
                photoPublicId: nextPhotoPublicId,
            });
            dispatchAuthProfileUpdated();
            clearSelectedPhotoPreview();
            setPhotoMode("keep");
            setProfileSuccess("Perfil atualizado com sucesso.");
        } catch (error) {
            console.error("Falha ao atualizar perfil:", error);
            setProfileError(resolveAuthErrorMessage(error, "Nao foi possivel atualizar o perfil agora."));
        } finally {
            setProfileLoading(false);
        }
    }

    async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user) {
            return;
        }

        if (!supportsPasswordChange || !user.email) {
            setPasswordError("Esta conta nao usa senha do Prism. Entre com o provedor conectado para gerenciar o acesso.");
            setPasswordSuccess("");
            return;
        }

        if (!currentPassword.trim()) {
            setPasswordError("Digite sua senha atual.");
            setPasswordSuccess("");
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError("A nova senha precisa ter no minimo 6 caracteres.");
            setPasswordSuccess("");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("As novas senhas nao conferem.");
            setPasswordSuccess("");
            return;
        }

        if (currentPassword === newPassword) {
            setPasswordError("Escolha uma senha diferente da atual.");
            setPasswordSuccess("");
            return;
        }

        setPasswordLoading(true);
        setPasswordError("");
        setPasswordSuccess("");

        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordSuccess("Senha alterada com sucesso.");
        } catch (error) {
            console.error("Falha ao trocar senha:", error);
            setPasswordError(resolveAuthErrorMessage(error, "Nao foi possivel alterar a senha agora."));
        } finally {
            setPasswordLoading(false);
        }
    }

    return (
        <section className="space-y-4">
            <article className="">
                <div className="flex items-center gap-4 py-7">
                    <span className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white/[0.05] text-lg font-semibold text-white">
                        {previewPhotoUrl ? <img src={previewPhotoUrl} alt={`Foto de ${userName}`} className="h-full w-full object-cover" /> : userInitial}
                    </span>
                    <div className="">
                        <h2 className="mt-2 truncate text-lg font-semibold text-white">{userName}</h2>
                        <p className="truncate text-sm text-white/50">{user?.email ?? "Email indisponível"}</p>
                    </div>
                </div>
            </article>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <article className="rounded-lg border border-white/[0.08] bg-[#101010] p-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04]">
                                <ImagePlus size={20} />
                            </span>
                            <h3 className="text-lg font-medium text-white">Editar perfil</h3>
                        </div>
                    </div>

                    <form onSubmit={handleProfileSubmit} className="mt-5 space-y-4">
                        <label className="block text-sm text-white/80">
                            <span className="ml-1 font-light">Nome de usuário</span>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(event) => {
                                    setDisplayName(event.target.value);
                                    setProfileError("");
                                    setProfileSuccess("");
                                }}
                                placeholder="Como voce quer aparecer no Prism"
                                maxLength={60}
                                className="mt-2 w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70"
                            />
                        </label>

                        <div className="grid gap-4 lg:grid-cols-[120px_1fr]">
                            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                                <span className="inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-xl font-semibold text-white">
                                    {previewPhotoUrl ? <img src={previewPhotoUrl} alt={`Foto de ${userName}`} className="h-full w-full object-cover" /> : userInitial}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06]"
                                >
                                    Enviar foto
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoFileChange} className="hidden" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={handleKeepCurrentPhoto}
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06]"
                                    >
                                        Usar foto atual
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRemovePhoto}
                                        className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100 transition-colors hover:border-red-400/30 hover:bg-red-500/15"
                                    >
                                        <Trash2 size={15} />
                                        Remover foto
                                    </button>
                                </div>
                            </div>
                        </div>

                        {profileError && <p className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{profileError}</p>}
                        {profileSuccess && <p className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{profileSuccess}</p>}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={profileLoading}
                                className="rounded-2xl border border-white/[0.1] bg-white/[0.05]  hover:border-white/[0.16] hover:bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {profileLoading ? "Salvando perfil..." : "Salvar perfil"}
                            </button>
                        </div>
                    </form>
                </article>

                <article className="rounded-lg border border-white/[0.08] bg-[#101010] p-3">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04]">
                            <KeyRound size={20} />
                        </span>
                        <h3 className="text-lg font-medium text-white">Segurança</h3>
                    </div>

                    <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
                        <label className="block text-sm text-white/80">
                            <span className="ml-1 font-light">Senha atual</span>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(event) => {
                                    setCurrentPassword(event.target.value);
                                    setPasswordError("");
                                    setPasswordSuccess("");
                                }}
                                autoComplete="current-password"
                                disabled={!supportsPasswordChange || passwordLoading}
                                className="mt-2 w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                        </label>

                        <label className="block text-sm text-white/80">
                            <span className="ml-1 font-light">Nova senha</span>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(event) => {
                                    setNewPassword(event.target.value);
                                    setPasswordError("");
                                    setPasswordSuccess("");
                                }}
                                autoComplete="new-password"
                                disabled={!supportsPasswordChange || passwordLoading}
                                className="mt-2 w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                        </label>

                        <label className="block text-sm text-white/80">
                            <span className="ml-1 font-light">Confirmar nova senha</span>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(event) => {
                                    setConfirmPassword(event.target.value);
                                    setPasswordError("");
                                    setPasswordSuccess("");
                                }}
                                autoComplete="new-password"
                                disabled={!supportsPasswordChange || passwordLoading}
                                className="mt-2 w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                        </label>

                        {!supportsPasswordChange && (
                            <p className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60">A senha desta conta e controlada pelo provedor conectado.</p>
                        )}
                        {passwordError && <p className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{passwordError}</p>}
                        {passwordSuccess && <p className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{passwordSuccess}</p>}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={!supportsPasswordChange || passwordLoading}
                                className="rounded-2xl border border-white/[0.1] bg-white/[0.05]  hover:border-white/[0.16] hover:bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {passwordLoading ? "Atualizando senha..." : "Trocar senha"}
                            </button>
                        </div>
                    </form>
                </article>
            </section>

            <article className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Sessão atual</h3>
                        <p className="mt-1 text-sm text-white/45">Ações relacionadas à conta autenticada no Prism Finance.</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void onSignOut()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100 transition-colors hover:border-red-400/30 hover:bg-red-500/15"
                    >
                        <LogOut size={16} />
                        Trocar de conta
                    </button>
                </div>
            </article>
        </section>
    );
}
