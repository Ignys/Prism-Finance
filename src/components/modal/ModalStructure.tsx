import { useEffect, useRef } from "react";
import { useModal } from "../../context/ModalContext";

interface ModalStructureProps {
    height: string | number;
    width: string | number;
    children: React.ReactNode;
    closeOnEscape?: boolean;
}

export function ModalStructure({ height, width, children, closeOnEscape = true }: ModalStructureProps) {
    const { closeModal } = useModal();
    const background = useRef<HTMLDivElement>(null);
    const resolvedWidth = typeof width === "number" ? `${width}px` : width;
    const resolvedHeight = typeof height === "number" ? `${height}px` : height;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof MouseEvent && background.current && e.target instanceof Node && !background.current.contains(e.target)) {
                closeModal();
            } else if (closeOnEscape && e instanceof KeyboardEvent && e.key === "Escape") {
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
        <div style={{ height: resolvedHeight, width: `min(95vw, ${resolvedWidth})`, maxHeight: "90vh" }} ref={background}>
            <div className="h-full">{children}</div>
        </div>
    );
}
