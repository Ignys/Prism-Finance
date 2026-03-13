import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { type Wallet, useFinanceActions, useFinanceWallets } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON, isDefaultWalletIcon, normalizeWalletColor, normalizeWalletIcon } from "../../lib/walletVisual";
import { WalletAvatar } from "../common/WalletAvatar";

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

function parseAmount(value: string): number {
    return Number(value.trim().replace(",", "."));
}

export function AddWallet({ mode = "create", walletId, initialWallet }: AddWalletProps) {
    const wallets = useFinanceWallets();
    const { addWallet } = useFinanceActions();
    const { closeModal } = useModal();

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
    const [uploadError, setUploadError] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [isProcessingUpload, setIsProcessingUpload] = useState(false);

    useEffect(() => {
        if (mode === "edit") {
            if (!editingWallet) {
                return;
            }

            const normalizedIcon = normalizeWalletIcon(editingWallet.icon);
            const usingDefaultIcon = isDefaultWalletIcon(normalizedIcon);

            setName(editingWallet.name);
            setInitialBalanceInput(String(editingWallet.initialBalance));
            setWalletColor(normalizeWalletColor(editingWallet.color));
            setCustomIcon(usingDefaultIcon ? null : normalizedIcon);
            setIconUrlInput(!usingDefaultIcon && /^https?:\/\//i.test(normalizedIcon) ? normalizedIcon : "");
            setUploadError("");
            setSubmitError("");
            return;
        }

        setName("");
        setInitialBalanceInput("");
        setWalletColor(DEFAULT_WALLET_COLOR);
        setCustomIcon(null);
        setIconUrlInput("");
        setUploadError("");
        setSubmitError("");
    }, [editingWallet, mode]);

    const isEditMode = mode === "edit" && Boolean(editingWallet);
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

    const handleSubmit = async () => {
        if (!canSubmit || isProcessingUpload) {
            return;
        }

        if (!normalizedName) {
            setSubmitError("Informe o nome da carteira.");
            return;
        }

        if (!initialBalanceInput.trim()) {
            setSubmitError("Informe o saldo inicial da carteira.");
            return;
        }

        const initialBalance = parseAmount(initialBalanceInput);
        if (!Number.isFinite(initialBalance)) {
            setSubmitError("Saldo inicial invalido.");
            return;
        }

        if (initialBalance < 0) {
            setSubmitError("Saldo inicial nao pode ser negativo.");
            return;
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
            createdAt: targetWallet?.createdAt ?? new Date().toISOString(),
        });

        closeModal();
    };

    return (
        <div className="rounded-lg bg-neutral-800 p-6">
            <h2 className="mb-5 text-2xl font-semibold">{isEditMode ? "Editar carteira" : "Nova carteira"}</h2>
            <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                }}
            >
                {mode === "edit" && !editingWallet && (
                    <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Carteira nao encontrada.</p>
                )}

                <div className="flex flex-col gap-1.5 text-left">
                    <label htmlFor="wallet-name" className="text-xs uppercase tracking-[0.12em] text-white/45">
                        Nome da carteira
                    </label>
                    <input
                        id="wallet-name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="rounded border border-neutral-600 bg-neutral-700 p-2.5 text-white placeholder-neutral-400"
                        placeholder="Ex: Carteira do Banco X"
                        maxLength={70}
                    />
                </div>

                <div className="flex flex-col gap-1.5 text-left">
                    <label htmlFor="wallet-balance" className="text-xs uppercase tracking-[0.12em] text-white/45">
                        Saldo inicial
                    </label>
                    <input
                        id="wallet-balance"
                        type="number"
                        value={initialBalanceInput}
                        onChange={(event) => setInitialBalanceInput(event.target.value)}
                        className="rounded border border-neutral-600 bg-neutral-700 p-2.5 text-white placeholder-neutral-400"
                        placeholder="Ex: 1000.00"
                        step="0.01"
                        min="0"
                    />
                </div>

                <div className="rounded-lg border border-white/10 bg-neutral-900/70 p-3">
                    <div className="mb-3 flex items-center gap-3">
                        <WalletAvatar wallet={previewWallet} className="h-14 w-14 rounded-xl border border-white/10" iconSize={26} iconStrokeWidth={1.7} />
                        <div>
                            <p className="text-sm font-medium">Icone da carteira (opcional)</p>
                            <p className="text-xs text-white/50">Upload local processado (max 320px) ou URL externa.</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <label htmlFor="wallet-file-upload" className="text-xs uppercase tracking-[0.12em] text-white/45">
                            Upload
                        </label>
                        <input
                            id="wallet-file-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="rounded border border-neutral-600 bg-neutral-700 p-2 text-sm"
                            disabled={isProcessingUpload}
                        />

                        <label htmlFor="wallet-url-input" className="text-xs uppercase tracking-[0.12em] text-white/45">
                            URL da imagem
                        </label>
                        <div className="flex gap-2">
                            <input
                                id="wallet-url-input"
                                type="text"
                                value={iconUrlInput}
                                onChange={(event) => setIconUrlInput(event.target.value)}
                                className="flex-1 rounded border border-neutral-600 bg-neutral-700 p-2.5 text-sm"
                                placeholder="https://..."
                            />
                            <button type="button" onClick={applyImageUrl} className="rounded border border-white/20 px-3 text-xs uppercase tracking-[0.08em] text-white/75 transition-colors hover:bg-white/[0.08]">
                                Usar URL
                            </button>
                            <button type="button" onClick={clearCustomIcon} className="rounded border border-white/20 px-3 text-xs uppercase tracking-[0.08em] text-white/75 transition-colors hover:bg-white/[0.08]">
                                Icone padrao
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input type="color" value={walletColor} onChange={(event) => setWalletColor(event.target.value)} className="h-10 w-14 rounded border border-neutral-600 bg-neutral-700 p-1" />
                    <input
                        type="text"
                        value={walletColor}
                        onChange={(event) => setWalletColor(event.target.value)}
                        className="flex-1 rounded border border-neutral-600 bg-neutral-700 p-2.5"
                        placeholder={DEFAULT_WALLET_COLOR}
                    />
                </div>

                {uploadError && <p className="text-sm text-amber-200">{uploadError}</p>}
                {submitError && <p className="text-sm text-red-200">{submitError}</p>}

                <button
                    type="submit"
                    disabled={!canSubmit || isProcessingUpload}
                    className="default-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isEditMode ? "Salvar alteracoes" : "Criar carteira"}
                </button>
            </form>
        </div>
    );
}
