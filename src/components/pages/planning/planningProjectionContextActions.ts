export type PlanningProjectionContextItemType = "income" | "expense" | "wishlist";
export type PlanningProjectionContextActionId = "toggle" | "edit" | "remove";

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
}

export function buildPlanningProjectionContextActions({
    itemType,
    isActive,
    canRemove = itemType !== "wishlist",
    editLabel = "Editar",
    canEdit = true,
}: BuildPlanningProjectionContextActionsParams): PlanningProjectionContextAction[] {
    const actions: PlanningProjectionContextAction[] = [
        {
            id: "toggle",
            itemType,
            label: isActive ? "Desativar" : "Ativar",
        },
    ];

    if (canEdit) {
        actions.push({
            id: "edit",
            itemType,
            label: editLabel,
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
