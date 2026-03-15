import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { type CreditCard, useFinanceActions, useFinanceCreditCards, useFinanceWallets } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";
import {
    DEFAULT_CREDIT_CARD_ICON,
    DEFAULT_WALLET_COLOR,
    isDefaultCreditCardIcon,
    isDefaultWalletIcon,
    normalizeWalletColor,
    normalizeWalletIcon,
} from "../../lib/walletVisual";
import { WalletAvatar } from "../common/WalletAvatar";

const MAX_IMAGE_SIZE_BYTES = 350 * 1024;
const MAX_IMAGE_DIMENSION = 320;

interface AddCreditCardProps {
    mode?: "create" | "edit";
    creditCardId?: string;
    initialCreditCard?: CreditCard;
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

function parseDay(value: string): number {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed)) {
        return 1;
    }
    return Math.min(31, Math.max(1, parsed));
}

const FIELD_LABEL_CLASS = "text-[11px] uppercase tracking-[0.12em] text-white/50";
const FIELD_INPUT_CLASS =
    "w-full rounded-xl border border-white/[0.12] bg-black/35 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";
const SECONDARY_BUTTON_CLASS =
    "rounded-lg border border-white/[0.18] px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] text-white/75 transition-colors hover:border-white/[0.28] hover:bg-white/[0.08]";

export function AddCreditCard({ mode = "create", creditCardId, initialCreditCard }: AddCreditCardProps) {
    const creditCards = useFinanceCreditCards();
    const wallets = useFinanceWallets();
    const { addCreditCard, deleteCreditCard, setCreditCardActive } = useFinanceActions();
    const { closeModal } = useModal();

    const editingCreditCard = useMemo(() => {
        if (mode !== "edit") {
            return null;
        }
        if (initialCreditCard) {
            return initialCreditCard;
        }
        if (!creditCardId) {
            return null;
        }
        return creditCards.find((card) => card.id === creditCardId) ?? null;
    }, [creditCardId, creditCards, initialCreditCard, mode]);

    const [name, setName] = useState("");
    const [limitInput, setLimitInput] = useState("");
    const [closingDayInput, setClosingDayInput] = useState("10");
    const [dueDayInput, setDueDayInput] = useState("15");
    const [bankWalletId, setBankWalletId] = useState<string>("");
    const [cardColor, setCardColor] = useState(DEFAULT_WALLET_COLOR);
    const [customIcon, setCustomIcon] = useState<string | null>(null);
    const [iconUrlInput, setIconUrlInput] = useState("");
    const [uploadError, setUploadError] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [isProcessingUpload, setIsProcessingUpload] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const activeWallets = useMemo(() => wallets.filter((wallet) => wallet.isActive), [wallets]);
    const selectableWallets = useMemo(
        () => wallets.filter((wallet) => wallet.isActive || wallet.id === bankWalletId),
        [bankWalletId, wallets],
    );

    useEffect(() => {
        if (mode === "edit") {
            if (!editingCreditCard) {
                return;
            }

            const normalizedIcon = normalizeWalletIcon(editingCreditCard.icon);
            const usingDefaultIcon = isDefaultWalletIcon(normalizedIcon) || isDefaultCreditCardIcon(normalizedIcon);

            setName(editingCreditCard.name);
            setLimitInput(formatAmountInputFromValue(editingCreditCard.limit));
            setClosingDayInput(String(editingCreditCard.closingDay));
            setDueDayInput(String(editingCreditCard.dueDay));
            setBankWalletId(editingCreditCard.bankWalletId ?? activeWallets[0]?.id ?? "");
            setCardColor(normalizeWalletColor(editingCreditCard.color));
            setCustomIcon(usingDefaultIcon ? null : normalizedIcon);
            setIconUrlInput(!usingDefaultIcon && /^https?:\/\//i.test(normalizedIcon) ? normalizedIcon : "");
            setUploadError("");
            setSubmitError("");
            setConfirmingDelete(false);
            return;
        }

        setName("");
        setLimitInput("");
        setClosingDayInput("10");
        setDueDayInput("15");
        setBankWalletId(activeWallets[0]?.id ?? "");
        setCardColor(DEFAULT_WALLET_COLOR);
        setCustomIcon(null);
        setIconUrlInput("");
        setUploadError("");
        setSubmitError("");
        setConfirmingDelete(false);
    }, [activeWallets, editingCreditCard, mode]);

    useEffect(() => {
        const fallbackWalletId = activeWallets[0]?.id ?? wallets[0]?.id ?? "";
        if (!selectableWallets.some((wallet) => wallet.id === bankWalletId)) {
            setBankWalletId(fallbackWalletId);
        }
    }, [activeWallets, bankWalletId, selectableWallets, wallets]);

    const isEditMode = mode === "edit" && Boolean(editingCreditCard);
    const canSubmit = mode !== "edit" || Boolean(editingCreditCard);
    const normalizedName = name.trim();
    const resolvedColor = normalizeWalletColor(cardColor);
    const resolvedIcon = customIcon ?? DEFAULT_CREDIT_CARD_ICON;

    const previewCard = useMemo<Pick<CreditCard, "icon" | "name" | "color">>(
        () => ({
            icon: resolvedIcon,
            name: normalizedName || "Cartao",
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
            console.error("Failed to submit credit card modal:", error);
        }

        setSubmitting(false);
    };

    const handleSubmit = () =>
        runAction(async () => {
            if (!canSubmit || isProcessingUpload) {
                return false;
            }

            if (!normalizedName) {
                setSubmitError("Informe o nome do cartao.");
                return false;
            }

            if (!limitInput.trim()) {
                setSubmitError("Informe o limite do cartao.");
                return false;
            }

            const limit = parseAmountInput(limitInput);
            if (!Number.isFinite(limit) || limit < 0) {
                setSubmitError("Limite invalido.");
                return false;
            }

            const closingDay = parseDay(closingDayInput);
            const dueDay = parseDay(dueDayInput);

            setSubmitError("");

            await addCreditCard({
                id: editingCreditCard?.id ?? uuidv4(),
                name: normalizedName,
                icon: resolvedIcon,
                color: resolvedColor,
                limit,
                closingDay,
                dueDay,
                bankWalletId: bankWalletId.trim() || null,
                isActive: editingCreditCard?.isActive ?? true,
                createdAt: editingCreditCard?.createdAt ?? new Date().toISOString(),
            });

            return true;
        });

    const handleDelete = () =>
        runAction(async () => {
            if (!editingCreditCard) {
                return false;
            }

            await deleteCreditCard(editingCreditCard.id);
            return true;
        });

    const handleReactivate = () =>
        runAction(async () => {
            if (!editingCreditCard || editingCreditCard.isActive) {
                return false;
            }

            await setCreditCardActive(editingCreditCard.id, true);
            return true;
        });

    return (
        <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-5 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
            <h2 className="text-2xl font-medium uppercase">{isEditMode ? "Editar cartao" : "Novo cartao"}</h2>

            <form
                className="mt-4 flex flex-col gap-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                }}
            >
                {mode === "edit" && !editingCreditCard && (
                    <p className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Cartao nao encontrado.</p>
                )}

                <label className="flex flex-col gap-1.5">
                    <span className={FIELD_LABEL_CLASS}>Nome do cartao</span>
                    <input
                        id="credit-card-name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className={FIELD_INPUT_CLASS}
                        placeholder="Ex: Cartao Principal"
                        maxLength={70}
                    />
                </label>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Limite</span>
                        <input
                            id="credit-card-limit"
                            inputMode="numeric"
                            value={limitInput}
                            onChange={(event) => setLimitInput(formatCurrencyFromDigits(extractCurrencyDigits(event.target.value)))}
                            className={FIELD_INPUT_CLASS}
                            placeholder="R$ 0,00"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Fechamento</span>
                        <input
                            id="credit-card-closing"
                            type="number"
                            value={closingDayInput}
                            onChange={(event) => setClosingDayInput(event.target.value)}
                            className={FIELD_INPUT_CLASS}
                            min="1"
                            max="31"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Vencimento</span>
                        <input
                            id="credit-card-due"
                            type="number"
                            value={dueDayInput}
                            onChange={(event) => setDueDayInput(event.target.value)}
                            className={FIELD_INPUT_CLASS}
                            min="1"
                            max="31"
                        />
                    </label>
                </div>

                <label className="flex flex-col gap-1.5">
                    <span className={FIELD_LABEL_CLASS}>Banco (carteira vinculada)</span>
                    <select
                        id="credit-card-wallet"
                        value={bankWalletId}
                        onChange={(event) => setBankWalletId(event.target.value)}
                        className={`${FIELD_INPUT_CLASS} appearance-none`}
                    >
                        <option value="">Sem vinculo</option>
                        {selectableWallets.map((wallet) => (
                            <option key={wallet.id} value={wallet.id}>
                                {wallet.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3">
                    <div className="mb-3 flex items-center gap-3">
                        <WalletAvatar wallet={previewCard} className="h-14 w-14 rounded-xl border border-white/[0.12]" iconSize={26} iconStrokeWidth={1.7} />
                        <div>
                            <p className="text-sm font-medium text-white">Icone do cartao (opcional)</p>
                            <p className="text-xs text-white/50">Upload local processado (max 320px) ou URL externa.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                            <span className={FIELD_LABEL_CLASS}>Upload</span>
                            <input
                                id="credit-card-file-upload"
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
                                id="credit-card-url-input"
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
                    <p className={`${FIELD_LABEL_CLASS} mb-2`}>Cor do cartao</p>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={cardColor}
                            onChange={(event) => setCardColor(event.target.value)}
                            className="h-10 w-14 rounded-lg border border-white/[0.16] bg-black/40 p-1"
                        />
                        <input
                            type="text"
                            value={cardColor}
                            onChange={(event) => setCardColor(event.target.value)}
                            className={FIELD_INPUT_CLASS}
                            placeholder={DEFAULT_WALLET_COLOR}
                        />
                    </div>
                </div>

                {uploadError && <p className="text-sm text-amber-200">{uploadError}</p>}
                {submitError && <p className="text-sm text-red-200">{submitError}</p>}

                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {isEditMode && editingCreditCard && (
                            <button
                                type="button"
                                onClick={() => (editingCreditCard.isActive ? setConfirmingDelete((current) => !current) : void handleReactivate())}
                                disabled={submitting}
                                className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    editingCreditCard.isActive
                                        ? "border-red-400/25 bg-red-500/10 text-red-200 hover:border-red-400/45 hover:text-red-100"
                                        : "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/20"
                                }`}
                            >
                                {editingCreditCard.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                {editingCreditCard.isActive ? "Excluir" : "Reativar"}
                            </button>
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
                            {submitting ? "Processando..." : isEditMode ? "Salvar alteracoes" : "Criar cartao"}
                        </button>
                    </div>
                </div>
            </form>

            {confirmingDelete && editingCreditCard && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4"
                    onClick={() => setConfirmingDelete(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-red-400/25 bg-[#171717] p-5 text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start gap-2">
                            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-200" />
                            <div>
                                <h3 className="text-lg font-semibold">Excluir cartao?</h3>
                                <p className="mt-1 text-sm text-white/70">
                                    Se existir historico de transacoes, o cartao sera arquivado e nao podera ser usado em novas transacoes.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmingDelete(false)}
                                disabled={submitting}
                                className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.14] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:border-white/[0.24] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleDelete()}
                                disabled={submitting}
                                className="inline-flex min-w-28 items-center justify-center rounded-xl border border-red-400/35 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 transition-colors hover:border-red-400/55 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Confirmar exclusao
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
