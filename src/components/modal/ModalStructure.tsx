import { useEffect, useRef } from "react";
import { useModal } from "../../context/ModalContext";

interface ModalStructureProps {
    height: string | number;
    width: string | number;
    children: React.ReactNode;
    topContent?: React.ReactNode;
    closeOnEscape?: boolean;
}

export function ModalStructure({ height, width, children, topContent, closeOnEscape = true }: ModalStructureProps) {
    const { closeModal } = useModal();
    const background = useRef<HTMLDivElement>(null);
    const resolvedWidth = typeof width === "number" ? `${width}px` : width;
    const resolvedHeight = typeof height === "number" ? `${height}px` : height;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | KeyboardEvent) => {
            const targetElement = e.target instanceof Element ? e.target : null;
            const isInsideModalOverlay = Boolean(targetElement?.closest('[data-modal-overlay-root="true"]'));

            if (e instanceof MouseEvent && background.current && e.target instanceof Node && !background.current.contains(e.target) && !isInsideModalOverlay) {
                closeModal();
            } else if (closeOnEscape && e instanceof KeyboardEvent && e.key === "Escape" && !document.querySelector('[data-modal-overlay-root="true"]')) {
                closeModal();
            }
        };

        document.addEventListener("mousedown", handleClickOutside, true);
        document.addEventListener("keydown", handleClickOutside, true);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside, true);
            document.removeEventListener("keydown", handleClickOutside, true);
        };
    }, [closeModal, closeOnEscape]);

    return (
        <div style={{ width: `min(95vw, ${resolvedWidth})`, maxHeight: "94vh" }} ref={background} className="flex flex-col items-center gap-2">
            {topContent ? <div className="shrink-0">{topContent}</div> : null}
            <div style={{ height: resolvedHeight, maxHeight: topContent ? "calc(94vh - 40px)" : "90vh" }} className="flex w-full min-h-0 flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}
