import { Eye, EyeOff } from "lucide-react";

interface RegistrySectionActionsProps {
    isShowingInactive: boolean;
    showLabel: string;
    hideLabel: string;
    createLabel: string;
    onToggleInactive: () => void;
    onCreate: () => void;
}

const ACTION_BUTTON_CLASSNAME =
    "inline-flex items-center gap-1 cursor-pointer rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-0.5 text-xs uppercase tracking-wide text-neutral-300 transition-colors hover:bg-white/[0.06]";

const CREATE_BUTTON_CLASSNAME = `${ACTION_BUTTON_CLASSNAME} px-4`;

export function RegistrySectionActions({
    isShowingInactive,
    showLabel,
    hideLabel,
    createLabel,
    onToggleInactive,
    onCreate,
}: RegistrySectionActionsProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onToggleInactive} className={ACTION_BUTTON_CLASSNAME}>
                {isShowingInactive ? <EyeOff size={13} /> : <Eye size={13} />}
                {isShowingInactive ? hideLabel : showLabel}
            </button>
            <button type="button" onClick={onCreate} className={CREATE_BUTTON_CLASSNAME}>
                {createLabel}
            </button>
        </div>
    );
}
