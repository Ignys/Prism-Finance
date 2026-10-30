import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, CircleDollarSign, CreditCard as CreditCardIcon, ImageUp, Landmark, Link2, RotateCcw, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { type CreditCard, type Wallet, useFinanceActions, useFinanceCreditCards, useFinanceWallets } from "../../context/FinanceContext";
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
import { ConfirmActionModal } from "./ConfirmActionModal";
import { IconTextField } from "../transactions/IconTextField";
import { DayOfMonthField } from "../transactions/DayOfMonthField";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../transactions/SingleSelectCombobox";
import { WalletOptionContent } from "../transactions/TransactionFormParts";
import { TransactionFieldIcon } from "../transactions/TransactionFieldIcon";
import { FIELD_EMBEDDED_INPUT_CLASS, FIELD_ICON_CONTROL_CLASS } from "../transactions/transactionForm.constants";
import { ModalBody, ModalCancelButton, ModalError, ModalFooter, ModalFooterAction, ModalHeader, ModalPanel, ModalPrimaryButton } from "./ModalChrome";

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

const NO_WALLET_OPTION_ID = "__no-wallet__";

interface BankWalletOption extends ComboboxOptionBase {
    wallet: Wallet | null;
}

const SECONDARY_BUTTON_CLASS = "shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.03] px-2 py-1 text-[11px] uppercase tracking-[0.04em] text-white/62 transition-colors hover:border-white/[0.28] hover:text-white disabled:cursor-not-allowed disabled:opacity-45";

export function AddCreditCard({ mode = "create", creditCardId, initialCreditCard }: AddCreditCardProps) {
    const creditCards = useFinanceCreditCards();
    const wallets = useFinanceWallets();
    const { addCreditCard, deleteCreditCard, permanentlyDeleteCreditCard, setCreditCardActive } = useFinanceActions();
    const { closeModal, openModal } = useModal();

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
    const activeWallets = useMemo(() => wallets.filter((wallet) => wallet.isActive), [wallets]);
    const selectableWallets = useMemo(
        () => wallets.filter((wallet) => wallet.isActive || wallet.id === bankWalletId),
        [bankWalletId, wallets],
    );
    const walletOptions = useMemo<BankWalletOption[]>(
        () => [
            { id: NO_WALLET_OPTION_ID, label: "Sem carteira vinculada", searchText: "sem carteira nenhuma", wallet: null },
            ...selectableWallets.map((wallet) => ({ id: wallet.id, label: wallet.name, searchText: wallet.name, wallet })),
        ],
        [selectableWallets],
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
    }, [activeWallets, editingCreditCard, mode]);

    useEffect(() => {
        const fallbackWalletId = activeWallets[0]?.id ?? wallets[0]?.id ?? "";
        if (bankWalletId && !selectableWallets.some((wallet) => wallet.id === bankWalletId)) {
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

    const openPermanentDeleteModal = () => {
        if (!editingCreditCard || editingCreditCard.isActive) {
            return;
        }

        openModal(
            <ConfirmActionModal
                title="Excluir cartao em definitivo?"
                description={`O cartao "${editingCreditCard.name}" sera removido permanentemente.`}
                consequences={[
                    "Compras, parcelas e recorrencias ligadas a este cartao serao removidas em definitivo.",
                    "Pagamentos de fatura vinculados a este cartao tambem serao removidos.",
                    "As faturas deste cartao serao apagadas permanentemente.",
                ]}
                confirmLabel="Excluir em definitivo"
                onConfirm={() => permanentlyDeleteCreditCard(editingCreditCard.id)}
            />,
        );
    };

    return (
        <ModalPanel>
            <ModalHeader title={isEditMode ? "Editando cartão" : "Novo cartão"} disabled={submitting} />
            <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                }}
            >
                <ModalBody className="flex flex-col gap-2">
                    {mode === "edit" && !editingCreditCard && (
                        <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Cartão não encontrado.</p>
                    )}

                    <div className="flex items-stretch gap-2">
                        <label
                            className={`group relative flex shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-black/35 p-2 transition-colors ${isProcessingUpload ? "cursor-wait opacity-60" : "cursor-pointer hover:border-white/[0.24]"}`}
                            title="Enviar ícone (opcional)"
                        >
                            <WalletAvatar wallet={previewCard} className="h-[72px] w-[72px] rounded-xl border border-white/[0.12]" iconSize={30} iconStrokeWidth={1.7} />
                            <span className="absolute bottom-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.16] bg-[#131313] text-white/70 group-hover:text-white">
                                <ImageUp size={12} />
                            </span>
                            <input id="credit-card-file-upload" type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" disabled={isProcessingUpload} aria-label="Enviar ícone" />
                        </label>

                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <IconTextField ariaLabel="Nome do cartão" value={name} onChange={setName} placeholder="Nome do cartão. Ex.: Cartão principal" icon={CreditCardIcon} maxLength={70} />
                            <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                                <TransactionFieldIcon icon={CircleDollarSign} />
                                <input
                                    id="credit-card-limit"
                                    aria-label="Limite"
                                    inputMode="numeric"
                                    value={limitInput}
                                    onChange={(event) => setLimitInput(formatCurrencyFromDigits(extractCurrencyDigits(event.target.value)))}
                                    className={`${FIELD_EMBEDDED_INPUT_CLASS} tabular-nums`}
                                    placeholder="Limite"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <DayOfMonthField label="Fecha dia" value={parseDay(closingDayInput)} onChange={(day) => setClosingDayInput(String(day))} icon={CalendarClock} />
                        <DayOfMonthField label="Vence dia" value={parseDay(dueDayInput)} onChange={(day) => setDueDayInput(String(day))} icon={CalendarCheck} />
                    </div>

                    <SingleSelectCombobox
                        hideLabel
                        label="Banco (carteira vinculada)"
                        value={bankWalletId || NO_WALLET_OPTION_ID}
                        placeholder="Selecione a carteira vinculada"
                        emptyMessage="Nenhuma carteira encontrada."
                        options={walletOptions}
                        onChange={(value) => setBankWalletId(value === NO_WALLET_OPTION_ID ? "" : value)}
                        renderOptionContent={(option) => <BankWalletOptionContent option={option} />}
                    />

                    <div className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                        <TransactionFieldIcon icon={Link2} />
                        <input
                            id="credit-card-url-input"
                            aria-label="URL da imagem"
                            type="text"
                            value={iconUrlInput}
                            onChange={(event) => setIconUrlInput(event.target.value)}
                            className={FIELD_EMBEDDED_INPUT_CLASS}
                            placeholder="Ou cole a URL de uma imagem"
                        />
                        <button type="button" onClick={applyImageUrl} disabled={!iconUrlInput.trim()} className={SECONDARY_BUTTON_CLASS}>
                            Usar
                        </button>
                        <button type="button" onClick={clearCustomIcon} className={SECONDARY_BUTTON_CLASS}>
                            Ícone padrão
                        </button>
                    </div>

                    <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                        <input aria-label="Cor do cartão" type="color" value={cardColor} onChange={(event) => setCardColor(event.target.value)} className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-white/[0.12] bg-transparent p-0.5" />
                        <input aria-label="Código da cor" type="text" value={cardColor} onChange={(event) => setCardColor(event.target.value)} className={FIELD_EMBEDDED_INPUT_CLASS} placeholder={DEFAULT_WALLET_COLOR} />
                    </label>

                    {uploadError && <p className="pl-1 text-sm text-amber-200">{uploadError}</p>}
                </ModalBody>

                {submitError ? <ModalError>{submitError}</ModalError> : null}

                <ModalFooter
                    start={
                        isEditMode && editingCreditCard ? (
                            <>
                                <ModalFooterAction onClick={() => (editingCreditCard.isActive ? void handleDelete() : void handleReactivate())} disabled={submitting}>
                                    {editingCreditCard.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                    {editingCreditCard.isActive ? "Arquivar" : "Reativar"}
                                </ModalFooterAction>
                                {!editingCreditCard.isActive ? (
                                    <ModalFooterAction tone="danger" onClick={openPermanentDeleteModal} disabled={submitting}>
                                        <Trash2 size={15} /> Excluir em definitivo
                                    </ModalFooterAction>
                                ) : null}
                            </>
                        ) : null
                    }
                >
                    <ModalCancelButton disabled={submitting} />
                    <ModalPrimaryButton type="submit" disabled={!canSubmit || isProcessingUpload || submitting}>
                        {submitting ? "Salvando..." : isEditMode ? "Salvar" : "Criar cartão"}
                    </ModalPrimaryButton>
                </ModalFooter>
            </form>
        </ModalPanel>
    );
}

function BankWalletOptionContent({ option }: { option: BankWalletOption }) {
    if (option.wallet) {
        return <WalletOptionContent option={{ label: option.label, wallet: option.wallet }} />;
    }

    return (
        <div className="flex items-center gap-2">
            <TransactionFieldIcon icon={Landmark} />
            <span className="truncate text-white/70">{option.label}</span>
        </div>
    );
}
