import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { normalizeComparisonText } from "../../context/finance/helpers";

export interface ComboboxOptionBase {
    id: string;
    label: string;
    searchText: string;
}

interface SingleSelectComboboxProps<T extends ComboboxOptionBase> {
    label: string;
    value: string;
    placeholder: string;
    emptyMessage: string;
    options: T[];
    onChange: (value: string) => void;
    renderOptionContent: (option: T) => ReactNode;
    renderSelectedContent?: (option: T) => ReactNode;
    labelClassName?: string;
    labelContent?: ReactNode;
    disabled?: boolean;
    disableSearch?: boolean;
    compactTrigger?: boolean;
}

const DEFAULT_LABEL_CLASS = "text-[11px] uppercase tracking-[0.12em] text-white/50";

export function SingleSelectCombobox<T extends ComboboxOptionBase>({
    label,
    value,
    placeholder,
    emptyMessage,
    options,
    onChange,
    renderOptionContent,
    renderSelectedContent,
    labelClassName = DEFAULT_LABEL_CLASS,
    labelContent,
    disabled = false,
    disableSearch = false,
    compactTrigger = false,
}: SingleSelectComboboxProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(() => options.find((option) => option.id === value) ?? null, [options, value]);
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

    useEffect(() => {
        if (!disabled) {
            return;
        }

        setIsOpen(false);
        setQuery("");
    }, [disabled]);

    const handleSelect = (nextValue: string) => {
        onChange(nextValue);
        setIsOpen(false);
        setQuery("");
    };

    return (
        <div ref={wrapperRef} className="relative flex flex-col gap-1.5">
            {labelContent ? labelContent : <span className={labelClassName}>{label}</span>}
            <button
                type="button"
                onClick={() => {
                    if (disabled) {
                        return;
                    }
                    setIsOpen((current) => !current);
                }}
                disabled={disabled}
                className={`flex w-full items-center justify-between rounded-xl border border-white/[0.1] bg-black/35 px-3 ${compactTrigger ? "py-1.5 text-xs" : "py-2.5 text-sm"} text-left text-white transition-colors ${
                    disabled ? "cursor-not-allowed opacity-60" : "hover:border-white/[0.2]"
                }`}
            >
                <div className="min-w-0 flex-1">
                    {selectedOption ? renderSelectedContent ? renderSelectedContent(selectedOption) : renderOptionContent(selectedOption) : <span className="text-white/40">{placeholder}</span>}
                </div>
                <ChevronsUpDown size={15} className="ml-2 shrink-0 text-white/55" />
            </button>

            {isOpen && !disabled && (
                <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-xl border border-white/[0.1] bg-[#101010] p-2 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.95)]">
                    {!disableSearch && (
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
                    )}

                    <div className="max-h-56 space-y-1 overflow-y-auto">
                        {filteredOptions.map((option) => {
                            const selected = option.id === value;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelect(option.id)}
                                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                                        selected ? "bg-white/[0.1] text-white" : "text-white/80 hover:bg-white/[0.06]"
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">{renderOptionContent(option)}</div>
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
