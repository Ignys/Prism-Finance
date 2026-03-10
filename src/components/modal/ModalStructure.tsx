import { useEffect, useRef } from "react";
import { useModal } from "../../context/ModalContext";

export function ModalStructure({ height, width, children }: { height: string | number; width: string | number; children: React.ReactNode }) {
    const { closeModal } = useModal();
    const background = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof MouseEvent && background.current && e.target instanceof Node && !background.current.contains(e.target)) {
                closeModal();
            } else if (e instanceof KeyboardEvent && e.key === "Escape") {
                closeModal();
            }
        };

        document.addEventListener("mouseup", handleClickOutside, true);
        document.addEventListener("keydown", handleClickOutside, true);
        return () => {
            document.removeEventListener("mouseup", handleClickOutside, true);
            document.removeEventListener("keydown", handleClickOutside, true);
        };
    }, [closeModal]);

    return (
        <div style={{ height, width }} ref={background}>
            <div className="h-full">{children}</div>
        </div>
    );
}
