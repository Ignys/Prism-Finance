import { useEffect, useRef } from "react";
import { useModal } from "../../context/ModalContext";

export function ModalStructure({ height, width, children }) {
    const {closeModal} = useModal()
    const background = useRef(null);

    useEffect(() => {
        document.addEventListener("mouseup", handleClickOutside, true);
        document.addEventListener("keydown", handleClickOutside, true);
    }, []);
    const handleClickOutside = (e) => {
        if (e instanceof MouseEvent && background.current && !background.current.contains(e.target)) {
            closeModal();
        } else if (e instanceof KeyboardEvent && e.key === "Escape") {
            closeModal();
        }
    };
    
    return (
        <div style={{ height: height, width: width }} ref={background}>
            <div className="h-full">{children}</div>
        </div>
    )
}