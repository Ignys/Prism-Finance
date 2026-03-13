import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { type Beneficiary, useFinanceActions, useFinanceBeneficiaries } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { ModalStructure } from "./ModalStructure";

const FIELD_LABEL_CLASS = "text-[11px] uppercase tracking-[0.12em] text-white/50";
const FIELD_INPUT_CLASS = "rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";

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
    const { addBeneficiary, setBeneficiaryActive } = useFinanceActions();
    const { closeModal } = useModal();
    const [submitting, setSubmitting] = useState(false);

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
        if (editingBeneficiary) {
            setName(editingBeneficiary.name);
            setType(editingBeneficiary.type);
            setAvatarColor(editingBeneficiary.avatarColor ?? "#4B5563");
            setAvatarImage(editingBeneficiary.avatarImage ?? null);
            setAvatarUrlInput(editingBeneficiary.avatarImage ?? "");
            return;
        }

        setName("");
        setType("person");
        setAvatarColor("#4B5563");
        setAvatarImage(null);
        setAvatarUrlInput("");
        setUploadError("");
    }, [editingBeneficiary]);

    const normalizedName = name.trim();
    const isEditMode = mode === "edit" && Boolean(editingBeneficiary);

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
            setSubmitting(false);
        } catch (error) {
            console.error("Failed to submit beneficiary modal:", error);
            setSubmitting(false);
        }
    };

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

    const handleSubmit = () =>
        runAction(async () => {
            if (!normalizedName) {
                return false;
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
                sortOrder: targetBeneficiary?.sortOrder ?? 0,
                createdAt: targetBeneficiary?.createdAt ?? new Date().toISOString(),
            });
            return true;
        });

    const handleToggleActive = () =>
        runAction(async () => {
            if (!editingBeneficiary) {
                return false;
            }
            await setBeneficiaryActive(editingBeneficiary.id, !editingBeneficiary.isActive);
            return true;
        });

    return (
        <ModalStructure height="auto" width="620px">
            <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-medium">{isEditMode ? "Editar beneficiario" : "Novo beneficiario"}</h2>
                        <p className="text-xs uppercase tracking-[0.12em] text-white/45">Cadastro de beneficiarios</p>
                    </div>
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={submitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                        aria-label="Fechar modal"
                        title="Fechar"
                    >
                        <X size={15} />
                    </button>
                </div>

                <section className="mt-4 grid grid-cols-1 gap-3">
                    {mode === "edit" && !editingBeneficiary && (
                        <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Beneficiario nao encontrado.</p>
                    )}

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Nome</span>
                        <input type="text" value={name} onChange={(event) => setName(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="Nome do beneficiario" />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Tipo</span>
                        <select value={type} onChange={(event) => setType(event.target.value as (typeof BENEFICIARY_TYPES)[number]["value"])} className={FIELD_INPUT_CLASS}>
                            {BENEFICIARY_TYPES.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3">
                        <div className="mb-3 flex items-center gap-3">
                            <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10">
                                {avatarImage ? <img src={avatarImage} alt="Preview" className="h-full w-full object-cover" /> : <div className="h-full w-full" style={{ backgroundColor: avatarColor }} />}
                            </div>
                            <div>
                                <p className="text-sm font-medium">Foto do beneficiario (opcional)</p>
                                <p className="text-xs text-white/50">Upload local (max 320px) ou URL externa.</p>
                            </div>
                        </div>

                        <div className="grid gap-3">
                            <label className="flex flex-col gap-1.5">
                                <span className={FIELD_LABEL_CLASS}>Upload</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className={`${FIELD_INPUT_CLASS} p-2 text-sm`}
                                    disabled={isProcessingUpload || submitting}
                                />
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className={FIELD_LABEL_CLASS}>URL da imagem</span>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={avatarUrlInput}
                                        onChange={(event) => setAvatarUrlInput(event.target.value)}
                                        className={`${FIELD_INPUT_CLASS} flex-1`}
                                        placeholder="https://..."
                                        disabled={submitting}
                                    />
                                    <button
                                        type="button"
                                        onClick={applyImageUrl}
                                        disabled={submitting}
                                        className="rounded-xl border border-white/[0.15] bg-white/[0.03] px-3 text-xs uppercase tracking-[0.08em] text-white/75 transition-colors hover:border-white/[0.28] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Usar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearImage}
                                        disabled={submitting}
                                        className="rounded-xl border border-white/[0.15] bg-white/[0.03] px-3 text-xs uppercase tracking-[0.08em] text-white/75 transition-colors hover:border-white/[0.28] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </label>
                            {uploadError && <p className="text-sm text-amber-200">{uploadError}</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <input type="color" value={avatarColor} onChange={(event) => setAvatarColor(event.target.value)} className="h-10 w-14 rounded border border-white/[0.12] bg-black/35 p-1" />
                        <input type="text" value={avatarColor} onChange={(event) => setAvatarColor(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="#4B5563" />
                    </div>
                </section>

                <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {isEditMode && editingBeneficiary && (
                            <button
                                type="button"
                                onClick={() => void handleToggleActive()}
                                disabled={submitting}
                                className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    editingBeneficiary.isActive
                                        ? "border-red-400/25 bg-red-500/10 text-red-200 hover:border-red-400/45 hover:text-red-100"
                                        : "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/20"
                                }`}
                            >
                                {editingBeneficiary.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                {editingBeneficiary.isActive ? "Remover" : "Reativar"}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={submitting}
                            className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSubmit()}
                            disabled={(mode === "edit" && !editingBeneficiary) || !normalizedName || submitting || isProcessingUpload}
                            className="inline-flex min-w-28 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? "Processando..." : "Concluir"}
                        </button>
                    </div>
                </div>
            </div>
        </ModalStructure>
    );
}
