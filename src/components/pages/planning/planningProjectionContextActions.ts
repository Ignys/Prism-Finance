export type PlanningProjectionContextItemType = "income" | "expense" | "wishlist";
export type PlanningProjectionContextActionId = "toggle" | "edit" | "move" | "restore" | "remove";

export interface PlanningProjectionContextAction {
    id: PlanningProjectionContextActionId;
    label: string;
    itemType: PlanningProjectionContextItemType;
    tone?: "default" | "danger";
}

interface BuildPlanningProjectionContextActionsParams {
    itemType: PlanningProjectionContextItemType;
    isActive: boolean;
    canRemove?: boolean;
    editLabel?: string;
    canEdit?: boolean;
    canMove?: boolean;
    canRestore?: boolean;
    canToggle?: boolean;
}

export function buildPlanningProjectionContextActions({
    itemType,
    isActive,
    canRemove = itemType !== "wishlist",
    editLabel = "Editar",
    canEdit = true,
    canMove = false,
    canRestore = false,
    canToggle = true,
}: BuildPlanningProjectionContextActionsParams): PlanningProjectionContextAction[] {
    const actions: PlanningProjectionContextAction[] = [];

    if (canToggle) {
        actions.push({
            id: "toggle",
            itemType,
            label: isActive ? "Desativar" : "Ativar",
        });
    }

    if (canEdit) {
        actions.push({
            id: "edit",
            itemType,
            label: editLabel,
        });
    }

    if (canMove) {
        actions.push({
            id: "move",
            itemType,
            label: "Mover para outro mês",
        });
    }

    if (canRestore) {
        actions.push({
            id: "restore",
            itemType,
            label: "Retornar para mês original",
        });
    }

    if (canRemove) {
        actions.push({
            id: "remove",
            itemType,
            label: "Remover",
            tone: "danger",
        });
    }

    return actions;
}
