import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Transaction, TransactionType } from "../../context/FinanceContext";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { AnchoredOverlay } from "./AnchoredOverlay";
import { FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from "./transactionForm.constants";
import {
    getTransactionDescriptionSuggestions,
    MIN_DESCRIPTION_SUGGESTION_QUERY_LENGTH,
} from "./transactionDescriptionSuggestions";

interface DescriptionAutocompleteProps {
    allowedCategoryIds: string[];
    disabled?: boolean;
    excludeTransactionId?: string;
    onChange: (value: string) => void;
    onSuggestionSelect: (transaction: Transaction) => void;
    transactions: Transaction[];
    type: TransactionType;
    value: string;
}

export function DescriptionAutocomplete({
    allowedCategoryIds,
    disabled = false,
    excludeTransactionId,
    onChange,
    onSuggestionSelect,
    transactions,
    type,
    value,
}: DescriptionAutocompleteProps) {
    const inputId = useId();
    const listboxId = `${inputId}-suggestions`;
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const wrapperRef = useRef<HTMLLabelElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const suggestions = useMemo(
        () =>
            getTransactionDescriptionSuggestions({
                allowedCategoryIds,
                excludeTransactionId,
                query: value,
                transactions,
                type,
            }),
        [allowedCategoryIds, excludeTransactionId, transactions, type, value],
    );
    const showSuggestions = isOpen && !disabled && suggestions.length > 0;

    useEffect(() => {
        setActiveIndex((current) => Math.min(current, Math.max(0, suggestions.length - 1)));
    }, [suggestions.length]);

    useEffect(() => {
        if (!showSuggestions) {
            return;
        }

        const handleOutsideInteraction = (event: MouseEvent | FocusEvent) => {
            if (!(event.target instanceof Node)) {
                return;
            }
            if (wrapperRef.current?.contains(event.target) || overlayRef.current?.contains(event.target)) {
                return;
            }
            setIsOpen(false);
        };

        document.addEventListener("mousedown", handleOutsideInteraction, true);
        document.addEventListener("focusin", handleOutsideInteraction);
        return () => {
            document.removeEventListener("mousedown", handleOutsideInteraction, true);
            document.removeEventListener("focusin", handleOutsideInteraction);
        };
    }, [showSuggestions]);

    useEffect(() => {
        if (disabled) {
            setIsOpen(false);
        }
    }, [disabled]);

    const selectSuggestion = (suggestion: Transaction) => {
        onChange(suggestion.description);
        onSuggestionSelect(suggestion);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            selectSuggestion(suggestions[activeIndex]);
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            setIsOpen(false);
        }
    };

    return (
        <label ref={wrapperRef} className="flex flex-col gap-1.5" htmlFor={inputId}>
            <span className={FIELD_LABEL_CLASS}>Descrição</span>
            <input
                ref={inputRef}
                id={inputId}
                className={FIELD_INPUT_CLASS}
                placeholder="Descrição da transação"
                value={value}
                onChange={(event) => {
                    const nextValue = event.target.value;
                    onChange(nextValue);
                    setActiveIndex(0);
                    setIsOpen(nextValue.trim().length >= MIN_DESCRIPTION_SUGGESTION_QUERY_LENGTH);
                }}
                onFocus={() => {
                    if (value.trim().length >= MIN_DESCRIPTION_SUGGESTION_QUERY_LENGTH) {
                        setIsOpen(true);
                    }
                }}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                maxLength={160}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls={showSuggestions ? listboxId : undefined}
                aria-expanded={showSuggestions}
                aria-activedescendant={showSuggestions ? `${listboxId}-${suggestions[activeIndex]?.id}` : undefined}
            />

            <AnchoredOverlay anchorRef={inputRef} overlayRef={overlayRef} isOpen={showSuggestions} preferredMaxHeight={360} className="rounded-xl border border-white/[0.12] bg-[#101010] p-1.5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.98)]">
                <div id={listboxId} role="listbox" aria-label="Sugestões de transações" className="space-y-1">
                    {suggestions.map((suggestion, index) => {
                        const Icon = getCategoryIconComponent(suggestion.category.icon, suggestion.category.type);
                        const isActive = index === activeIndex;

                        return (
                            <button
                                key={suggestion.id}
                                id={`${listboxId}-${suggestion.id}`}
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => selectSuggestion(suggestion)}
                                className={`grid w-full grid-cols-[40px_minmax(0,1fr)] grid-rows-[auto_auto] items-center gap-x-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                                    isActive ? "bg-white/[0.09]" : "hover:bg-white/[0.06]"
                                }`}
                            >
                                <span
                                    className="row-span-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12]"
                                    style={{
                                        color: suggestion.category.color ?? "#CBD5E1",
                                        backgroundColor: `${suggestion.category.color ?? "#64748B"}22`,
                                    }}
                                >
                                    <Icon size={17} />
                                </span>
                                <span className="min-w-0 break-words text-sm font-medium leading-5 text-white/90">{suggestion.description}</span>
                                <span className="min-w-0 truncate text-xs text-white/45">{suggestion.category.label}</span>
                            </button>
                        );
                    })}
                </div>
            </AnchoredOverlay>
        </label>
    );
}
