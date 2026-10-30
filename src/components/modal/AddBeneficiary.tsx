import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Building2, ImageUp, Link2, PawPrint, RotateCcw, Shapes, Trash2, type LucideIcon, UserRound } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { type Beneficiary, useFinanceActions, useFinanceBeneficiaries } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { BeneficiaryAvatar } from "../common/BeneficiaryAvatar";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../transactions/SingleSelectCombobox";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { ModalStructure } from "./ModalStructure";
import { ModalBody, ModalCancelButton, ModalFooter, ModalFooterAction, ModalHeader, ModalPanel, ModalPrimaryButton } from "./ModalChrome";
import { IconTextField } from "../transactions/IconTextField";
import { TransactionFieldIcon } from "../transactions/TransactionFieldIcon";
import { FIELD_EMBEDDED_INPUT_CLASS, FIELD_ICON_CONTROL_CLASS } from "../transactions/transactionForm.constants";

const INLINE_BUTTON_CLASS = "shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.03] px-2 py-1 text-[11px] uppercase tracking-[0.04em] text-white/62 transition-colors hover:border-white/[0.28] hover:text-white disabled:cursor-not-allowed disabled:opacity-45";

type BeneficiaryTypeOption = {
    value: Beneficiary["type"];
    label: string;
    icon: LucideIcon;
    description: string;
    isLegacy?: boolean;
};

const BENEFICIARY_TYPES: BeneficiaryTypeOption[] = [
    { value: "person", label: "Pessoa", icon: UserRound, description: "Pessoa física ou contato principal" },
    { value: "pet", label: "Pet", icon: PawPrint, description: "Animal de estimação ou cuidado recorrente" },
    { value: "other", label: "Outro", icon: Shapes, description: "Qualquer outro tipo de beneficiário" },
] as const;

const LEGACY_BENEFICIARY_TYPE: BeneficiaryTypeOption = {
    value: "cost_center",
    label: "Centro de custo",
    icon: Building2,
    description: "Tipo legado mantido para edições existentes",
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
                consequences={["O beneficiário será removido do cadastro em definitivo.", "As transações relacionadas passarao automaticamente para o beneficiário do usuário."]}
                confirmLabel="Excluir em definitivo"
                onConfirm={() => permanentlyDeleteBeneficiary(editingBeneficiary.id)}
            />,
        );
    };

    const imageDisabled = isProcessingUpload || submitting || isReadOnlyBeneficiary;

    return (
        <ModalStructure height="auto" width="620px">
            <ModalPanel>
                <ModalHeader title={isEditMode ? "Editando beneficiário" : "Novo beneficiário"} disabled={submitting} />

                <ModalBody className="flex flex-col gap-2">
                    {mode === "edit" && !editingBeneficiary && <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Beneficiário não encontrado.</p>}
                    {isEditMode && isReadOnlyBeneficiary && <p className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">{readOnlyMessage}</p>}

                    <div className="flex items-stretch gap-2">
                        <label
                            className={`group relative flex shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-black/35 p-2 transition-colors ${imageDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-white/[0.24]"}`}
                            title="Enviar foto (opcional)"
                        >
                            <BeneficiaryAvatar
                                beneficiary={{ name: normalizedName || editingBeneficiary?.name || "Beneficiário", avatarImage, avatarColor }}
                                className="h-[72px] w-[72px] rounded-full border border-white/10"
                                textClassName="text-xl font-semibold text-white"
                            />
                            <span className="absolute bottom-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.16] bg-[#131313] text-white/70 group-hover:text-white">
                                <ImageUp size={12} />
                            </span>
                            <input type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" disabled={imageDisabled} aria-label="Enviar foto" />
                        </label>

                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <IconTextField ariaLabel="Nome do beneficiário" value={name} onChange={setName} placeholder="Nome do beneficiário" icon={UserRound} disabled={submitting || isReadOnlyBeneficiary} />
                            <SingleSelectCombobox
                                label="Tipo"
                                hideLabel
                                value={type}
                                placeholder="Selecione um tipo"
                                emptyMessage="Nenhum tipo encontrado."
                                options={typeComboboxOptions}
                                onChange={(value) => setType(value as Beneficiary["type"])}
                                renderOptionContent={(option) => <BeneficiaryTypeOptionContent option={option} />}
                                renderSelectedContent={(option) => <BeneficiaryTypeOptionContent option={option} />}
                                disabled={submitting || isReadOnlyBeneficiary}
                                disableSearch
                            />
                        </div>
                    </div>

                    <div className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2 ${isReadOnlyBeneficiary ? "opacity-60" : ""}`}>
                        <TransactionFieldIcon icon={Link2} />
                        <input
                            aria-label="URL da imagem"
                            type="text"
                            value={avatarUrlInput}
                            onChange={(event) => setAvatarUrlInput(event.target.value)}
                            className={FIELD_EMBEDDED_INPUT_CLASS}
                            placeholder="Ou cole a URL de uma imagem"
                            disabled={submitting || isReadOnlyBeneficiary}
                        />
                        <button type="button" onClick={applyImageUrl} disabled={submitting || isReadOnlyBeneficiary || !avatarUrlInput.trim()} className={INLINE_BUTTON_CLASS}>
                            Usar
                        </button>
                        {avatarImage ? (
                            <button type="button" onClick={clearImage} disabled={submitting || isReadOnlyBeneficiary} className={INLINE_BUTTON_CLASS}>
                                Remover foto
                            </button>
                        ) : null}
                    </div>
                    {uploadError && <p className="pl-1 text-sm text-amber-200">{uploadError}</p>}

                    <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2 ${isColorReadOnly ? "opacity-60" : ""}`}>
                        <input aria-label="Cor do avatar" type="color" value={avatarColor} onChange={(event) => setAvatarColor(event.target.value)} className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-white/[0.12] bg-transparent p-0.5" disabled={submitting || isColorReadOnly} />
                        <input aria-label="Código da cor" type="text" value={avatarColor} onChange={(event) => setAvatarColor(event.target.value)} className={FIELD_EMBEDDED_INPUT_CLASS} placeholder="#4B5563" disabled={submitting || isColorReadOnly} />
                    </label>
                </ModalBody>

                <ModalFooter
                    start={
                        isEditMode && editingBeneficiary && !isReadOnlyBeneficiary ? (
                            <>
                                <ModalFooterAction onClick={() => void handleToggleActive()} disabled={submitting}>
                                    {editingBeneficiary.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                    {editingBeneficiary.isActive ? "Arquivar" : "Reativar"}
                                </ModalFooterAction>
                                {!editingBeneficiary.isActive ? (
                                    <ModalFooterAction tone="danger" onClick={openPermanentDeleteModal} disabled={submitting}>
                                        <Trash2 size={15} /> Excluir em definitivo
                                    </ModalFooterAction>
                                ) : null}
                            </>
                        ) : null
                    }
                >
                    <ModalCancelButton disabled={submitting} />
                    <ModalPrimaryButton onClick={() => void handleSubmit()} disabled={(mode === "edit" && !editingBeneficiary) || !normalizedName || submitting || isProcessingUpload || isActionReadOnly}>
                        {isFamilySharedBeneficiary ? "Somente leitura" : submitting ? "Salvando..." : isSelfProfileBeneficiary ? "Salvar cor" : "Salvar"}
                    </ModalPrimaryButton>
                </ModalFooter>
            </ModalPanel>
        </ModalStructure>
    );
}
