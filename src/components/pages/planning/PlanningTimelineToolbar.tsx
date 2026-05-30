import { Columns2, Rows2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Wallet } from "../../../context/FinanceContext";
import { WalletAvatar } from "../../common/WalletAvatar";
import { MultiSelectCombobox } from "../../transactions/MultiSelectCombobox";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../../transactions/SingleSelectCombobox";
import { Switch } from "../../ui/Switch";
import { PLANNING_CONTROL_CENTER_TRIGGER_CLASS, PLANNING_CONTROL_TRIGGER_CLASS, PlanningControlGroup } from "./PlanningControlGroup";

export interface PlanningTimelineToolbarProps {
    compareMode: boolean;
    horizontalMode: boolean;
    timelineMonthCount: number;
    wallets: Wallet[];
    selectedWalletIds: string[];
    onCompareModeChange: (compareMode: boolean) => void;
    onHorizontalModeChange: (horizontalMode: boolean) => void;
    onSelectedWalletIdsChange: (walletIds: string[]) => void;
    onTimelineMonthCountChange: (monthCount: number) => void;
}

interface WalletOption extends ComboboxOptionBase {
    wallet: Wallet;
}

interface MonthCountOption extends ComboboxOptionBase {
    value: number;
}

const MONTH_COUNT_OPTIONS: MonthCountOption[] = [3, 6, 9, 12].map((value) => ({
    id: String(value),
    label: `${value} meses`,
    searchText: `${value} meses`,
    value,
}));

export function PlanningTimelineToolbar({
    compareMode,
    horizontalMode,
    timelineMonthCount,
    wallets,
    selectedWalletIds,
    onCompareModeChange,
    onHorizontalModeChange,
    onSelectedWalletIdsChange,
    onTimelineMonthCountChange,
}: PlanningTimelineToolbarProps) {
    const walletOptions: WalletOption[] = wallets.map((wallet) => ({
        id: wallet.id,
        label: wallet.name,
        searchText: `${wallet.name} ${wallet.type} ${wallet.isActive ? "ativa" : "arquivada"}`,
        wallet,
    }));

    return (
        <div className="flex flex-wrap gap-2">
            <PlanningControlGroup>
                <button type="button" className={PLANNING_CONTROL_CENTER_TRIGGER_CLASS} onClick={() => onHorizontalModeChange(!horizontalMode)}>
                    {horizontalMode ? (
                        <>
                            <Columns2 size={14} />
                            Visualização horizontal
                        </>
                    ) : (
                        <>
                            <Rows2 size={14} />
                            Visualização vertical
                        </>
                    )}
                </button>
            </PlanningControlGroup>

            <PlanningControlGroup>
                <MultiSelectCombobox
                    label="Carteiras"
                    labelClassName="sr-only"
                    triggerClassName={`${PLANNING_CONTROL_TRIGGER_CLASS} w-[200px]`}
                    allowEmptySelection={false}
                    values={selectedWalletIds}
                    placeholder="Selecione as carteiras"
                    emptyMessage="Nenhuma carteira encontrada."
                    options={walletOptions}
                    onChange={onSelectedWalletIdsChange}
                    renderSelectedSummary={(selectedOptions) => renderSelectionCount(selectedOptions.length, "carteira", "carteiras")}
                    renderOptionContent={(option) => <WalletOptionContent option={option} />}
                />
            </PlanningControlGroup>

            <PlanningControlGroup>
                <label className={PLANNING_CONTROL_TRIGGER_CLASS}>
                    <span>Visualizar projeções</span>
                    <Switch checked={compareMode} onCheckedChange={onCompareModeChange} aria-label="Alternar projeções" />
                </label>
            </PlanningControlGroup>

            <PlanningControlGroup>
                <SingleSelectCombobox
                    label="Meses exibidos"
                    labelClassName="sr-only"
                    triggerClassName={PLANNING_CONTROL_TRIGGER_CLASS}
                    value={String(timelineMonthCount)}
                    placeholder="Selecione"
                    emptyMessage="Nenhuma opção encontrada."
                    options={MONTH_COUNT_OPTIONS}
                    disableSearch
                    compactTrigger
                    onChange={(value) => onTimelineMonthCountChange(Number(value))}
                    renderOptionContent={(option) => <SelectOptionContent>{option.label}</SelectOptionContent>}
                    renderSelectedContent={(option) => <SelectOptionContent>{option.label}</SelectOptionContent>}
                />
            </PlanningControlGroup>
        </div>
    );
}

function WalletOptionContent({ option }: { option: WalletOption }) {
    return (
        <div className="flex min-w-0 items-center gap-2">
            <WalletAvatar wallet={option.wallet} className="h-7 w-7 rounded-md border border-white/10" iconSize={15} iconStrokeWidth={1.7} />
            <div className="min-w-0">
                <p className="truncate text-sm text-white/85">{option.wallet.name}</p>
                {!option.wallet.isActive ? <p className="text-xs text-white/38">Arquivada</p> : null}
            </div>
        </div>
    );
}

function renderSelectionCount(count: number, singular: string, plural: string) {
    return (
        <span className="rounded bg-white/[0.12] px-2 py-0.5 text-sm text-white/85">
            {count} {count > 1 ? plural : singular}
        </span>
    );
}

function SelectOptionContent({ children }: { children: ReactNode }) {
    return <span className="truncate text-sm text-white/85">{children}</span>;
}
