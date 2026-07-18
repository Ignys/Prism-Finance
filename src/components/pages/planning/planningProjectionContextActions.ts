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
}

export function buildPlanningProjectionContextActions({
    itemType,
    isActive,
    canRemove = itemType !== "wishlist",
}: BuildPlanningProjectionContextActionsParams): PlanningProjectionContextAction[] {
    const actions: PlanningProjectionContextAction[] = [
        {
            id: "toggle",
            itemType,
            label: isActive ? "Desativar" : "Ativar",
        },
        {
            id: "edit",
            itemType,
            label: "Editar",
        },
    ];

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
