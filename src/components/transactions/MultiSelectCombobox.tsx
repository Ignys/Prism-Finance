import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { normalizeComparisonText } from "../../context/finance/helpers";
import type { ComboboxOptionBase } from "./SingleSelectCombobox";

interface MultiSelectComboboxProps<T extends ComboboxOptionBase> {
    label: string;
    values: string[];
    placeholder: string;
    emptyMessage: string;
    options: T[];
    onChange: (values: string[]) => void;
    renderOptionContent: (option: T) => ReactNode;
    labelClassName?: string;
}

const DEFAULT_LABEL_CLASS = "text-[11px] uppercase tracking-[0.12em] text-white/50";

export function MultiSelectCombobox<T extends ComboboxOptionBase>({
    label,
    values,
    placeholder,
    emptyMessage,
    options,
    onChange,
    renderOptionContent,
    labelClassName = DEFAULT_LABEL_CLASS,
}: MultiSelectComboboxProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const normalizedValues = useMemo(() => Array.from(new Set(values)), [values]);
    const selectedOptions = useMemo(() => options.filter((option) => normalizedValues.includes(option.id)), [normalizedValues, options]);
    const filteredOptions = useMemo(() => {
        const normalizedQuery = normalizeComparisonText(query);
        if (!normalizedQuery) {
            return options;
        }

        return options.filter((option) => normalizeComparisonText(option.searchText).includes(normalizedQuery));
    }, [options, query]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleOutsideClick = (event: MouseEvent) => {
            if (!wrapperRef.current) {
                return;
            }

            if (event.target instanceof Node && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setQuery("");
            }
        };

        document.addEventListener("mousedown", handleOutsideClick, true);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick, true);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const focusTimeout = window.setTimeout(() => {
            searchInputRef.current?.focus();
        }, 0);

        return () => window.clearTimeout(focusTimeout);
    }, [isOpen]);

    const toggleOption = (optionId: string) => {
        const selectedSet = new Set(normalizedValues);
        if (selectedSet.has(optionId)) {
            selectedSet.delete(optionId);
        } else {
            selectedSet.add(optionId);
        }

        const nextValues = options.map((option) => option.id).filter((optionIdValue) => selectedSet.has(optionIdValue));
        onChange(nextValues);
    };

    const selectedSummary = useMemo(() => {
        if (selectedOptions.length < 1) {
            return placeholder;
        }

        const visible = selectedOptions.slice(0, 2).map((option) => option.label).join(", ");
        const hiddenCount = Math.max(selectedOptions.length - 2, 0);
        return hiddenCount > 0 ? `${visible} +${hiddenCount}` : visible;
    }, [placeholder, selectedOptions]);

    return (
        <div ref={wrapperRef} className="relative flex flex-col gap-1.5">
            <span className={labelClassName}>{label}</span>
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl border border-white/[0.1] bg-black/35 px-3 py-1.5 text-left text-xs text-white transition-colors hover:border-white/[0.2]"
            >
                <span className={` min-w-0 flex-1 truncate ${selectedOptions.length < 1 ? "text-white/40" : ""}`}>{selectedSummary}</span>
                <ChevronsUpDown size={15} className="ml-2 shrink-0 text-white/55" />
            </button>

            {isOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-xl border border-white/[0.1] bg-[#101010] p-2 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.95)]">
                    <div className="relative mb-2">
                        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                            ref={searchInputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar"
                            className="w-full rounded-lg border border-white/[0.1] bg-black/45 py-2 pl-8 pr-2 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.25]"
                        />
                    </div>

                    <div className="max-h-56 space-y-1 overflow-y-auto">
                        {filteredOptions.map((option) => {
                            const selected = normalizedValues.includes(option.id);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => toggleOption(option.id)}
                                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                                        selected ? "bg-white/[0.1] text-white" : "text-white/80 hover:bg-white/[0.06]"
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">{renderOptionContent(option)}</div>
                                    <span className="ml-2 shrink-0 text-emerald-300">{selected ? <Check size={14} /> : null}</span>
                                </button>
                            );
                        })}
                        {filteredOptions.length === 0 && <p className="px-2.5 py-1.5 text-sm text-white/45">{emptyMessage}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
