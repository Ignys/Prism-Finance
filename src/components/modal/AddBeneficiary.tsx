import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Building2, PawPrint, RotateCcw, Shapes, Trash2, type LucideIcon, UserRound, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { type Beneficiary, useFinanceActions, useFinanceBeneficiaries } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { BeneficiaryAvatar } from "../common/BeneficiaryAvatar";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../transactions/SingleSelectCombobox";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { ModalStructure } from "./ModalStructure";
import { FIELD_LABEL_CLASS } from "../transactions/transactionForm.constants";

const FIELD_INPUT_CLASS = "rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";

type BeneficiaryTypeOption = {
    value: Beneficiary["type"];
    label: string;
    icon: LucideIcon;
    description: string;
    isLegacy?: boolean;
};

const BENEFICIARY_TYPES: BeneficiaryTypeOption[] = [
    { value: "person", label: "Pessoa", icon: UserRound, description: "Pessoa fisica ou contato principal" },
    { value: "pet", label: "Pet", icon: PawPrint, description: "Animal de estimacao ou cuidado recorrente" },
    { value: "other", label: "Outro", icon: Shapes, description: "Qualquer outro tipo de beneficiario" },
] as const;

const LEGACY_BENEFICIARY_TYPE: BeneficiaryTypeOption = {
    value: "cost_center",
    label: "Centro de custo",
    icon: Building2,
    description: "Tipo legado mantido para edicoes existentes",
    isLegacy: true,
};

const MAX_IMAGE_SIZE_BYTES = 350 * 1024;
const MAX_IMAGE_DIMENSION = 320;

interface AddBeneficiaryProps {
    mode?: "create" | "edit";
    beneficiaryId?: string;
    initialBeneficiary?: Beneficiary;
}

interface BeneficiaryTypeComboboxOption extends ComboboxOptionBase {
    icon: LucideIcon;
}

function BeneficiaryTypeOptionContent({ option }: { option: BeneficiaryTypeComboboxOption }) {
    const Icon = option.icon;

    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] text-white/80">
                <Icon size={14} />
            </span>
            <span className="truncate">{option.label}</span>
        </div>
    );
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
    const { addBeneficiary, permanentlyDeleteBeneficiary, setBeneficiaryActive } = useFinanceActions();
    const { closeModal, openModal } = useModal();
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
    const typeOptions = type === "cost_center" ? [...BENEFICIARY_TYPES, LEGACY_BENEFICIARY_TYPE] : BENEFICIARY_TYPES;
    const typeComboboxOptions = useMemo<BeneficiaryTypeComboboxOption[]>(
        () =>
            typeOptions.map((item) => ({
                id: item.value,
                label: item.label,
                searchText: `${item.label} ${item.description}`,
                icon: item.icon,
            })),
        [typeOptions],
    );
    const isFamilySharedBeneficiary = editingBeneficiary?.source === "family_shared";
    const isSelfProfileBeneficiary = editingBeneficiary?.isSelfProfile === true;
    const isReadOnlyBeneficiary = isFamilySharedBeneficiary || isSelfProfileBeneficiary;
    const isActionReadOnly = isFamilySharedBeneficiary;
    const isColorReadOnly = isFamilySharedBeneficiary;
    const readOnlyMessage = isFamilySharedBeneficiary
        ? "Este beneficiário vem da família e acompanha o perfil compartilhado daquele membro."
        : isSelfProfileBeneficiary
          ? "Este beneficiário acompanha automaticamente o nome e a foto do seu perfil. Você ainda pode ajustar a cor usada no avatar."
          : "";

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
            if (!normalizedName || isActionReadOnly) {
                return false;
            }

            const targetBeneficiary = editingBeneficiary;
            const resolvedAvatarImage = normalizeAvatarImage(avatarImage ?? "") ?? normalizeAvatarImage(avatarUrlInput) ?? null;

            await addBeneficiary({
                id: targetBeneficiary?.id ?? uuidv4(),
                userId: targetBeneficiary?.userId ?? null,
                familyId: targetBeneficiary?.familyId ?? null,
                source: targetBeneficiary?.source ?? "personal",
                isSelfProfile: targetBeneficiary?.isSelfProfile ?? false,
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
            if (!editingBeneficiary || isReadOnlyBeneficiary) {
                return false;
            }
            await setBeneficiaryActive(editingBeneficiary.id, !editingBeneficiary.isActive);
            return true;
        });

    const openPermanentDeleteModal = () => {
        if (!editingBeneficiary || editingBeneficiary.isActive || isReadOnlyBeneficiary) {
            return;
        }

        openModal(
            <ConfirmActionModal
                title="Excluir beneficiário em definitivo?"
                description={`O beneficiário "${editingBeneficiary.name}" será removido permanentemente.`}
                consequences={[
                    "O beneficiário será removido do cadastro em definitivo.",
                    "As transações relacionadas passarao automaticamente para o beneficiário do usuário.",
                ]}
                confirmLabel="Excluir em definitivo"
                onConfirm={() => permanentlyDeleteBeneficiary(editingBeneficiary.id)}
            />,
        );
    };

    return (
        <ModalStructure height="auto" width="620px">
            <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <header className="flex items-center justify-between gap-3">
                    <h1 className="text-sm ml-1 uppercase opacity-50">{isEditMode ? "Editar beneficiario" : "Novo beneficiario"}</h1>
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={submitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                        aria-label="Fechar modal"
                        title="Fechar"
                    >
                        <X size={15} />
                    </button>
                </header>

                <section className="mt-4 grid grid-cols-1 gap-3">
                    {mode === "edit" && !editingBeneficiary && <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Beneficiário não encontrado.</p>}
                    {isEditMode && isReadOnlyBeneficiary && <p className="rounded-md border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">{readOnlyMessage}</p>}

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-2">
                        <label className="flex w-full flex-col gap-1.5 sm:w-1/2">
                            <span className={FIELD_LABEL_CLASS}>Nome</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                className={FIELD_INPUT_CLASS}
                                placeholder="Nome do beneficiário"
                                disabled={submitting || isReadOnlyBeneficiary}
                            />
                        </label>

                        <div className="w-full sm:w-1/2">
                            <SingleSelectCombobox
                                label="Tipo"
                                value={type}
                                placeholder="Selecione um tipo"
                                emptyMessage="Nenhum tipo encontrado."
                                options={typeComboboxOptions}
                                onChange={(value) => setType(value as Beneficiary["type"])}
                                renderOptionContent={(option) => <BeneficiaryTypeOptionContent option={option} />}
                                renderSelectedContent={(option) => <BeneficiaryTypeOptionContent option={option} />}
                                labelClassName={FIELD_LABEL_CLASS}
                                disabled={submitting || isReadOnlyBeneficiary}
                            />
                        </div>
                    </div>

                    {type === "cost_center" && (
                        <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                            Este beneficiário usa um tipo legado. Você pode mantê-lo assim ou trocar para uma das opções atuais.
                        </p>
                    )}

                    <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3">
                        <div className="mb-3 flex items-center gap-3">
                            <BeneficiaryAvatar
                                beneficiary={{
                                    name: normalizedName || editingBeneficiary?.name || "Beneficiario",
                                    avatarImage,
                                    avatarColor,
                                }}
                                className="h-14 w-14 rounded-full border border-white/10"
                                textClassName="text-lg font-semibold text-white"
                            />
                            <div>
                                <p className="text-sm font-medium">Foto do beneficiário (opcional)</p>
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
                                    disabled={isProcessingUpload || submitting || isReadOnlyBeneficiary}
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
                                        disabled={submitting || isReadOnlyBeneficiary}
                                    />
                                    <button
                                        type="button"
                                        onClick={applyImageUrl}
                                        disabled={submitting || isReadOnlyBeneficiary}
                                        className="rounded-xl border border-white/[0.15] bg-white/[0.03] px-3 text-xs uppercase tracking-[0.08em] text-white/75 transition-colors hover:border-white/[0.28] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Usar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearImage}
                                        disabled={submitting || isReadOnlyBeneficiary}
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
                        <input
                            type="color"
                            value={avatarColor}
                            onChange={(event) => setAvatarColor(event.target.value)}
                            className="h-10 w-14 rounded border border-white/[0.12] bg-black/35 p-1"
                            disabled={submitting || isColorReadOnly}
                        />
                        <input
                            type="text"
                            value={avatarColor}
                            onChange={(event) => setAvatarColor(event.target.value)}
                            className={FIELD_INPUT_CLASS}
                            placeholder="#4B5563"
                            disabled={submitting || isColorReadOnly}
                        />
                    </div>
                </section>

                <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {isEditMode && editingBeneficiary && !isReadOnlyBeneficiary && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => void handleToggleActive()}
                                    disabled={submitting}
                                    className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                        editingBeneficiary.isActive
                                            ? "border-amber-400/25 bg-amber-500/10 text-amber-100 hover:border-amber-400/45 hover:text-amber-50"
                                            : "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/20"
                                    }`}
                                >
                                    {editingBeneficiary.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                    {editingBeneficiary.isActive ? "Arquivar" : "Reativar"}
                                </button>

                                {!editingBeneficiary.isActive ? (
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
                            className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSubmit()}
                            disabled={(mode === "edit" && !editingBeneficiary) || !normalizedName || submitting || isProcessingUpload || isActionReadOnly}
                            className="inline-flex min-w-28 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isFamilySharedBeneficiary ? "Somente leitura" : submitting ? "Processando..." : isSelfProfileBeneficiary ? "Salvar cor" : "Concluir"}
                        </button>
                    </div>
                </div>
            </div>
        </ModalStructure>
    );
}
