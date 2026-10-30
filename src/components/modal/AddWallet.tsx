import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { CircleDollarSign, ImageUp, Link2, RotateCcw, Sigma, Trash2, Wallet as WalletIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_WALLET_ID, type Wallet, useFinanceActions, useFinanceWallets } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON, isDefaultWalletIcon, normalizeWalletColor, normalizeWalletIcon } from "../../lib/walletVisual";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { WalletAvatar } from "../common/WalletAvatar";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { IconTextField } from "../transactions/IconTextField";
import { TransactionFieldIcon } from "../transactions/TransactionFieldIcon";
import { FIELD_EMBEDDED_INPUT_CLASS, FIELD_ICON_CONTROL_CLASS } from "../transactions/transactionForm.constants";
import { ModalBody, ModalCancelButton, ModalError, ModalFooter, ModalFooterAction, ModalHeader, ModalPanel, ModalPrimaryButton } from "./ModalChrome";

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
        <ModalPanel>
            <ModalHeader title={isEditMode ? "Editando carteira" : "Nova carteira"} disabled={submitting} />
            <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                }}
            >
                <ModalBody className="flex flex-col gap-2">
                    {mode === "edit" && !editingWallet && <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Carteira não encontrada.</p>}

                    <div className="flex items-stretch gap-2">
                        <label
                            className={`group relative flex shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-black/35 p-2 transition-colors ${isProcessingUpload ? "cursor-wait opacity-60" : "cursor-pointer hover:border-white/[0.24]"}`}
                            title="Enviar ícone (opcional)"
                        >
                            <WalletAvatar wallet={previewWallet} className="h-[72px] w-[72px] rounded-xl border border-white/[0.12]" iconSize={30} iconStrokeWidth={1.7} />
                            <span className="absolute bottom-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.16] bg-[#131313] text-white/70 group-hover:text-white">
                                <ImageUp size={12} />
                            </span>
                            <input id="wallet-file-upload" type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" disabled={isProcessingUpload} aria-label="Enviar ícone" />
                        </label>

                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <IconTextField ariaLabel="Nome da carteira" value={name} onChange={setName} placeholder="Nome da carteira. Ex.: Banco X" icon={WalletIcon} maxLength={70} />
                            <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                                <TransactionFieldIcon icon={CircleDollarSign} />
                                <input
                                    id="wallet-balance"
                                    aria-label="Saldo inicial"
                                    inputMode="numeric"
                                    value={initialBalanceInput}
                                    onChange={(event) => setInitialBalanceInput(formatCurrencyFromDigits(extractCurrencyDigits(event.target.value)))}
                                    className={`${FIELD_EMBEDDED_INPUT_CLASS} tabular-nums`}
                                    placeholder="Saldo inicial"
                                />
                            </label>
                        </div>
                    </div>

                    <div className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                        <TransactionFieldIcon icon={Link2} />
                        <input
                            id="wallet-url-input"
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
                        <input aria-label="Cor da carteira" type="color" value={walletColor} onChange={(event) => setWalletColor(event.target.value)} className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-white/[0.12] bg-transparent p-0.5" />
                        <input aria-label="Código da cor" type="text" value={walletColor} onChange={(event) => setWalletColor(event.target.value)} className={FIELD_EMBEDDED_INPUT_CLASS} placeholder={DEFAULT_WALLET_COLOR} />
                    </label>

                    <div className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center justify-between gap-3`}>
                        <span className="flex items-center gap-2 text-sm text-white/80">
                            <TransactionFieldIcon icon={Sigma} />
                            Contabilizar no saldo atual
                        </span>
                        <ToggleSwitch checked={includeInMainTotals} onChange={setIncludeInMainTotals} label="Contabilizar no saldo atual" />
                    </div>

                    {uploadError && <p className="pl-1 text-sm text-amber-200">{uploadError}</p>}
                </ModalBody>

                {submitError ? <ModalError>{submitError}</ModalError> : null}

                <ModalFooter
                    start={
                        isEditMode && editingWallet && !isDefaultWallet ? (
                            <>
                                <ModalFooterAction onClick={() => (editingWallet.isActive ? void handleDelete() : void handleReactivate())} disabled={submitting}>
                                    {editingWallet.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                    {editingWallet.isActive ? "Arquivar" : "Reativar"}
                                </ModalFooterAction>
                                {!editingWallet.isActive ? (
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
                        {submitting ? "Salvando..." : isEditMode ? "Salvar" : "Criar carteira"}
                    </ModalPrimaryButton>
                </ModalFooter>
            </form>
        </ModalPanel>
    );
}
