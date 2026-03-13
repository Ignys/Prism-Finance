import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { type Beneficiary, useFinanceActions, useFinanceBeneficiaries } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { ModalStructure } from "./ModalStructure";

const BENEFICIARY_TYPES = [
    { value: "person", label: "Pessoa" },
    { value: "cost_center", label: "Centro de custo" },
    { value: "pet", label: "Pet" },
    { value: "other", label: "Outro" },
] as const;

const MAX_IMAGE_SIZE_BYTES = 350 * 1024;
const MAX_IMAGE_DIMENSION = 320;

interface AddBeneficiaryProps {
    mode?: "create" | "edit";
    beneficiaryId?: string;
    initialBeneficiary?: Beneficiary;
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

function normalizeAvatarImage(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) {
        return null;
    }
    if (normalized.startsWith("data:image/")) {
        return normalized;
    }
    if (/^https?:\/\//i.test(normalized)) {
        return normalized;
    }
    return null;
}

export function AddBeneficiary({ mode = "create", beneficiaryId, initialBeneficiary }: AddBeneficiaryProps) {
    const beneficiaries = useFinanceBeneficiaries();
    const { addBeneficiary } = useFinanceActions();
    const { closeModal } = useModal();

    const editingBeneficiary = useMemo(() => {
        if (mode !== "edit") {
            return null;
        }
        if (initialBeneficiary) {
            return initialBeneficiary;
        }
        if (!beneficiaryId) {
            return null;
        }
        return beneficiaries.find((item) => item.id === beneficiaryId) ?? null;
    }, [beneficiaries, beneficiaryId, initialBeneficiary, mode]);

    const [name, setName] = useState("");
    const [type, setType] = useState<(typeof BENEFICIARY_TYPES)[number]["value"]>("person");
    const [avatarColor, setAvatarColor] = useState("#4B5563");
    const [avatarImage, setAvatarImage] = useState<string | null>(null);
    const [avatarUrlInput, setAvatarUrlInput] = useState("");
    const [uploadError, setUploadError] = useState("");
    const [isProcessingUpload, setIsProcessingUpload] = useState(false);

    useEffect(() => {
        if (!editingBeneficiary) {
            return;
        }
        setName(editingBeneficiary.name);
        setType(editingBeneficiary.type);
        setAvatarColor(editingBeneficiary.avatarColor ?? "#4B5563");
        setAvatarImage(editingBeneficiary.avatarImage ?? null);
        setAvatarUrlInput(editingBeneficiary.avatarImage ?? "");
    }, [editingBeneficiary]);

    const normalizedName = name.trim();
    const isEditMode = mode === "edit" && Boolean(editingBeneficiary);

    const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }

        setUploadError("");
        setIsProcessingUpload(true);

        try {
            const optimized = await optimizeImageFile(file);
            setAvatarImage(optimized);
            setAvatarUrlInput("");
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : "Falha ao processar imagem.");
        } finally {
            setIsProcessingUpload(false);
        }
    };

    const applyImageUrl = () => {
        const normalized = normalizeAvatarImage(avatarUrlInput);
        if (!normalized) {
            setUploadError("Informe uma URL valida iniciando com http(s)://");
            return;
        }
        setUploadError("");
        setAvatarImage(normalized);
    };

    const clearImage = () => {
        setAvatarImage(null);
        setAvatarUrlInput("");
        setUploadError("");
    };

    const handleSubmit = async () => {
        if (!normalizedName) {
            return;
        }

        const targetBeneficiary = editingBeneficiary;
        const resolvedAvatarImage = normalizeAvatarImage(avatarImage ?? "") ?? normalizeAvatarImage(avatarUrlInput) ?? null;
        await addBeneficiary({
            id: targetBeneficiary?.id ?? uuidv4(),
            userId: targetBeneficiary?.userId ?? null,
            name: normalizedName,
            type,
            avatarColor: avatarColor.trim() || null,
            avatarImage: resolvedAvatarImage,
            isActive: targetBeneficiary?.isActive ?? true,
            createdAt: targetBeneficiary?.createdAt ?? new Date().toISOString(),
        });
        closeModal();
    };

    return (
        <ModalStructure height="auto" width="560px">
            <div className="rounded-lg bg-neutral-800 p-6">
                <h2 className="mb-5 text-2xl font-semibold">{isEditMode ? "Editar beneficiario" : "Novo beneficiario"}</h2>
                <div className="flex flex-col gap-4">
                    {mode === "edit" && !editingBeneficiary && (
                        <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Beneficiario nao encontrado.</p>
                    )}

                    <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="rounded border border-neutral-600 bg-neutral-700 p-2.5"
                        placeholder="Nome do beneficiario"
                    />

                    <select value={type} onChange={(event) => setType(event.target.value as (typeof BENEFICIARY_TYPES)[number]["value"])} className="rounded border border-neutral-600 bg-neutral-700 p-2.5">
                        {BENEFICIARY_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>

                    <div className="rounded-lg border border-white/10 bg-neutral-900/70 p-3">
                        <div className="mb-3 flex items-center gap-3">
                            <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10">
                                {avatarImage ? <img src={avatarImage} alt="Preview" className="h-full w-full object-cover" /> : <div className="h-full w-full" style={{ backgroundColor: avatarColor }} />}
                            </div>
                            <div>
                                <p className="text-sm font-medium">Foto do beneficiario (opcional)</p>
                                <p className="text-xs text-white/50">Upload processado localmente (max 320px) ou URL externa.</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-xs uppercase tracking-[0.12em] text-white/45">Upload</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="rounded border border-neutral-600 bg-neutral-700 p-2 text-sm"
                                disabled={isProcessingUpload}
                            />

                            <label className="text-xs uppercase tracking-[0.12em] text-white/45">URL da imagem</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={avatarUrlInput}
                                    onChange={(event) => setAvatarUrlInput(event.target.value)}
                                    className="flex-1 rounded border border-neutral-600 bg-neutral-700 p-2.5 text-sm"
                                    placeholder="https://..."
                                />
                                <button type="button" onClick={applyImageUrl} className="rounded border border-white/20 px-3 text-xs uppercase tracking-[0.08em] text-white/75 transition-colors hover:bg-white/[0.08]">
                                    Usar URL
                                </button>
                                <button type="button" onClick={clearImage} className="rounded border border-white/20 px-3 text-xs uppercase tracking-[0.08em] text-white/75 transition-colors hover:bg-white/[0.08]">
                                    Limpar
                                </button>
                            </div>
                            {uploadError && <p className="text-sm text-amber-200">{uploadError}</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <input type="color" value={avatarColor} onChange={(event) => setAvatarColor(event.target.value)} className="h-10 w-14 rounded border border-neutral-600 bg-neutral-700 p-1" />
                        <input type="text" value={avatarColor} onChange={(event) => setAvatarColor(event.target.value)} className="flex-1 rounded border border-neutral-600 bg-neutral-700 p-2.5" placeholder="#4B5563" />
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={mode === "edit" && !editingBeneficiary}
                        className="default-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isEditMode ? "Salvar alteracoes" : "Criar beneficiario"}
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
