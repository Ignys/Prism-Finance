import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_WALLET_ID, type Wallet, useFinanceActions, useFinanceWallets } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON, isDefaultWalletIcon, normalizeWalletColor, normalizeWalletIcon } from "../../lib/walletVisual";
import { WalletAvatar } from "../common/WalletAvatar";
import { ConfirmActionModal } from "./ConfirmActionModal";

const MAX_IMAGE_SIZE_BYTES = 350 * 1024;
const MAX_IMAGE_DIMENSION = 320;

interface AddWalletProps {
    mode?: "create" | "edit";
    walletId?: string;
    initialWallet?: Wallet;
}

function estimateDataUrlBytes(dataUrl: string): number {
    const commaIndex = dataUrl.indexOf(",");
    const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
    return Math.ceil((payload.length * 3) / 4);
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Nao foi possivel carregar a imagem."));
        image.src = dataUrl;
    });
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
    });
}

async function optimizeImageFile(file: File): Promise<string> {
    const sourceDataUrl = await readFileAsDataUrl(file);
    const image = await loadImageFromDataUrl(sourceDataUrl);

    const ratio = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Falha ao processar a imagem.");
    }

    context.drawImage(image, 0, 0, width, height);

    let quality = 0.86;
    let output = canvas.toDataURL("image/jpeg", quality);

    while (estimateDataUrlBytes(output) > MAX_IMAGE_SIZE_BYTES && quality > 0.45) {
        quality -= 0.08;
        output = canvas.toDataURL("image/jpeg", quality);
    }

    if (estimateDataUrlBytes(output) > MAX_IMAGE_SIZE_BYTES) {
        throw new Error("A imagem continua grande demais mesmo apos compressao.");
    }

    return output;
}

function normalizeHttpImageUrl(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) {
        return null;
    }
    if (/^https?:\/\//i.test(normalized)) {
        return normalized;
    }
    return null;
}

function formatAmountInputFromValue(value: number): string {
    const cents = Math.max(0, Math.round(Math.abs(value) * 100));
    return formatCurrencyFromDigits(String(cents));
}

function parseAmountInput(value: string): number {
    return parseCurrencyDigitsToNumber(extractCurrencyDigits(value));
}

const FIELD_LABEL_CLASS = "text-[11px] uppercase tracking-[0.12em] text-white/50";
const FIELD_INPUT_CLASS =
    "w-full rounded-xl border border-white/[0.12] bg-black/35 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";
const SECONDARY_BUTTON_CLASS =
    "rounded-lg border border-white/[0.18] px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] text-white/75 transition-colors hover:border-white/[0.28] hover:bg-white/[0.08]";

export function AddWallet({ mode = "create", walletId, initialWallet }: AddWalletProps) {
    const wallets = useFinanceWallets();
    const { addWallet, deleteWallet, permanentlyDeleteWallet, setWalletActive } = useFinanceActions();
    const { closeModal, openModal } = useModal();

    const editingWallet = useMemo(() => {
        if (mode !== "edit") {
            return null;
        }
        if (initialWallet) {
            return initialWallet;
        }
        if (!walletId) {
            return null;
        }
        return wallets.find((wallet) => wallet.id === walletId) ?? null;
    }, [initialWallet, mode, walletId, wallets]);

    const [name, setName] = useState("");
    const [initialBalanceInput, setInitialBalanceInput] = useState("");
    const [walletColor, setWalletColor] = useState(DEFAULT_WALLET_COLOR);
    const [customIcon, setCustomIcon] = useState<string | null>(null);
    const [iconUrlInput, setIconUrlInput] = useState("");
    const [includeInMainTotals, setIncludeInMainTotals] = useState(true);
    const [uploadError, setUploadError] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [isProcessingUpload, setIsProcessingUpload] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (mode === "edit") {
            if (!editingWallet) {
                return;
            }

            const normalizedIcon = normalizeWalletIcon(editingWallet.icon);
            const usingDefaultIcon = isDefaultWalletIcon(normalizedIcon);

            setName(editingWallet.name);
            setInitialBalanceInput(formatAmountInputFromValue(editingWallet.initialBalance));
            setWalletColor(normalizeWalletColor(editingWallet.color));
            setCustomIcon(usingDefaultIcon ? null : normalizedIcon);
            setIconUrlInput(!usingDefaultIcon && /^https?:\/\//i.test(normalizedIcon) ? normalizedIcon : "");
            setIncludeInMainTotals(editingWallet.includeInMainTotals);
            setUploadError("");
            setSubmitError("");
            return;
        }

        setName("");
        setInitialBalanceInput("");
        setWalletColor(DEFAULT_WALLET_COLOR);
        setCustomIcon(null);
        setIconUrlInput("");
        setIncludeInMainTotals(true);
        setUploadError("");
        setSubmitError("");
    }, [editingWallet, mode]);

    const isEditMode = mode === "edit" && Boolean(editingWallet);
    const isDefaultWallet = editingWallet?.id === DEFAULT_WALLET_ID;
    const canSubmit = mode !== "edit" || Boolean(editingWallet);
    const normalizedName = name.trim();
    const resolvedColor = normalizeWalletColor(walletColor);
    const resolvedIcon = customIcon ?? DEFAULT_WALLET_ICON;

    const previewWallet = useMemo<Pick<Wallet, "icon" | "name" | "color">>(
        () => ({
            icon: resolvedIcon,
            name: normalizedName || "Carteira",
            color: resolvedColor,
        }),
        [normalizedName, resolvedColor, resolvedIcon],
    );

    const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }

        setUploadError("");
        setSubmitError("");
        setIsProcessingUpload(true);

        try {
            const optimized = await optimizeImageFile(file);
            setCustomIcon(optimized);
            setIconUrlInput("");
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : "Falha ao processar imagem.");
        } finally {
            setIsProcessingUpload(false);
        }
    };

    const applyImageUrl = () => {
        const normalizedUrl = normalizeHttpImageUrl(iconUrlInput);
        if (!normalizedUrl) {
            setUploadError("Informe uma URL valida iniciando com http(s)://");
            return;
        }

        setUploadError("");
        setSubmitError("");
        setCustomIcon(normalizedUrl);
    };

    const clearCustomIcon = () => {
        setCustomIcon(null);
        setIconUrlInput("");
        setUploadError("");
        setSubmitError("");
    };

    const runAction = async (action: () => Promise<boolean>) => {
        if (submitting) {
            return;
        }

        setSubmitting(true);

        try {
            const success = await action();
            if (success) {
                closeModal();
                return;
            }
        } catch (error) {
            console.error("Failed to submit wallet modal:", error);
        }

        setSubmitting(false);
    };

    const handleSubmit = () =>
        runAction(async () => {
            if (!canSubmit || isProcessingUpload) {
                return false;
            }

            if (!normalizedName) {
                setSubmitError("Informe o nome da carteira.");
                return false;
            }

            if (!initialBalanceInput.trim()) {
                setSubmitError("Informe o saldo inicial da carteira.");
                return false;
            }

            const initialBalance = parseAmountInput(initialBalanceInput);
            if (!Number.isFinite(initialBalance)) {
                setSubmitError("Saldo inicial invalido.");
                return false;
            }

            if (initialBalance < 0) {
                setSubmitError("Saldo inicial nao pode ser negativo.");
                return false;
            }

            setSubmitError("");

            const targetWallet = editingWallet;
            await addWallet({
                id: targetWallet?.id ?? uuidv4(),
                name: normalizedName,
                icon: resolvedIcon,
                type: targetWallet?.type ?? "checking",
                balance: initialBalance,
                initialBalance,
                currency: targetWallet?.currency ?? "BRL",
                color: resolvedColor,
                isActive: targetWallet?.isActive ?? true,
                includeInMainTotals,
                createdAt: targetWallet?.createdAt ?? new Date().toISOString(),
            });

            return true;
        });

    const handleDelete = () =>
        runAction(async () => {
            if (!editingWallet || isDefaultWallet) {
                return false;
            }

            await deleteWallet(editingWallet.id);
            return true;
        });

    const handleReactivate = () =>
        runAction(async () => {
            if (!editingWallet || editingWallet.isActive) {
                return false;
            }

            await setWalletActive(editingWallet.id, true);
            return true;
        });

    const openPermanentDeleteModal = () => {
        if (!editingWallet || editingWallet.isActive || isDefaultWallet) {
            return;
        }

        openModal(
            <ConfirmActionModal
                title="Excluir carteira em definitivo?"
                description={`A carteira "${editingWallet.name}" sera removida permanentemente.`}
                consequences={[
                    "Transacoes e transferencias ligadas a esta carteira serao removidas em definitivo.",
                    "Pagamentos feitos por esta carteira tambem serao removidos.",
                    "Cartoes vinculados serao mantidos, mas faturas remanescentes podem ser recalculadas.",
                ]}
                confirmLabel="Excluir em definitivo"
                onConfirm={() => permanentlyDeleteWallet(editingWallet.id)}
            />,
        );
    };

    return (
        <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-5 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
            <h2 className="text-2xl font-medium uppercase">{isEditMode ? "Editar carteira" : "Nova carteira"}</h2>

            <form
                className="mt-4 flex flex-col gap-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                }}
            >
                {mode === "edit" && !editingWallet && (
                    <p className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Carteira nao encontrada.</p>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Nome da carteira</span>
                        <input
                            id="wallet-name"
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className={FIELD_INPUT_CLASS}
                            placeholder="Ex: Carteira do Banco X"
                            maxLength={70}
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Saldo inicial</span>
                        <input
                            id="wallet-balance"
                            inputMode="numeric"
                            value={initialBalanceInput}
                            onChange={(event) => setInitialBalanceInput(formatCurrencyFromDigits(extractCurrencyDigits(event.target.value)))}
                            className={FIELD_INPUT_CLASS}
                            placeholder="R$ 0,00"
                        />
                    </label>
                </div>

                <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-white">Contabilizar nos numeros principais</p>
                            <p className="mt-1 text-xs text-white/50">Quando desligado, esta carteira nao entra no Saldo, Receitas e Despesas globais do app.</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={includeInMainTotals}
                            onClick={() => setIncludeInMainTotals((current) => !current)}
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                                includeInMainTotals ? "border-emerald-400/45 bg-emerald-500/20" : "border-white/[0.14] bg-white/[0.06]"
                            }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                    includeInMainTotals ? "translate-x-6" : "translate-x-1"
                                }`}
                            />
                        </button>
                    </div>
                </div>

                <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3">
                    <div className="mb-3 flex items-center gap-3">
                        <WalletAvatar wallet={previewWallet} className="h-14 w-14 rounded-xl border border-white/[0.12]" iconSize={26} iconStrokeWidth={1.7} />
                        <div>
                            <p className="text-sm font-medium text-white">Icone da carteira (opcional)</p>
                            <p className="text-xs text-white/50">Upload local processado (max 320px) ou URL externa.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                            <span className={FIELD_LABEL_CLASS}>Upload</span>
                            <input
                                id="wallet-file-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className={`${FIELD_INPUT_CLASS} p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-2.5 file:py-1.5 file:text-xs file:uppercase file:tracking-[0.08em] file:text-white/80`}
                                disabled={isProcessingUpload}
                            />
                        </label>

                        <label className="flex flex-col gap-1.5">
                            <span className={FIELD_LABEL_CLASS}>URL da imagem</span>
                            <input
                                id="wallet-url-input"
                                type="text"
                                value={iconUrlInput}
                                onChange={(event) => setIconUrlInput(event.target.value)}
                                className={FIELD_INPUT_CLASS}
                                placeholder="https://..."
                            />
                        </label>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={applyImageUrl} className={SECONDARY_BUTTON_CLASS}>
                            Usar URL
                        </button>
                        <button type="button" onClick={clearCustomIcon} className={SECONDARY_BUTTON_CLASS}>
                            Icone padrao
                        </button>
                    </div>
                </div>

                <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3">
                    <p className={`${FIELD_LABEL_CLASS} mb-2`}>Cor da carteira</p>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={walletColor}
                            onChange={(event) => setWalletColor(event.target.value)}
                            className="h-10 w-14 rounded-lg border border-white/[0.16] bg-black/40 p-1"
                        />
                        <input
                            type="text"
                            value={walletColor}
                            onChange={(event) => setWalletColor(event.target.value)}
                            className={FIELD_INPUT_CLASS}
                            placeholder={DEFAULT_WALLET_COLOR}
                        />
                    </div>
                </div>

                {uploadError && <p className="text-sm text-amber-200">{uploadError}</p>}
                {submitError && <p className="text-sm text-red-200">{submitError}</p>}

                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {isEditMode && editingWallet && !isDefaultWallet && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => (editingWallet.isActive ? void handleDelete() : void handleReactivate())}
                                    disabled={submitting}
                                    className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                        editingWallet.isActive
                                            ? "border-amber-400/25 bg-amber-500/10 text-amber-100 hover:border-amber-400/45 hover:text-amber-50"
                                            : "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/20"
                                    }`}
                                >
                                    {editingWallet.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                    {editingWallet.isActive ? "Arquivar" : "Reativar"}
                                </button>

                                {!editingWallet.isActive ? (
                                    <button
                                        type="button"
                                        onClick={openPermanentDeleteModal}
                                        disabled={submitting}
                                        className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition-colors hover:border-red-400/45 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Trash2 size={15} />
                                        Excluir em definitivo
                                    </button>
                                ) : null}
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={submitting}
                            className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit || isProcessingUpload || submitting}
                            className="inline-flex min-w-32 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? "Processando..." : isEditMode ? "Salvar alteracoes" : "Criar carteira"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
