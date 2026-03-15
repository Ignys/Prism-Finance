import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useModal } from "../../context/ModalContext";

export function DisplayModal() {
    const { modal } = useModal();

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        if (modal) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = previousOverflow;
        }

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [modal]);

    return (
        <AnimatePresence>
            {modal && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                    />

                    <motion.div
                        className="fixed inset-0 flex justify-center items-center-safe z-[100] text-white"
                        initial={{ opacity: 0, y: -200 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        transition={{ duration: 0.3, ease: [0, 0.5, 0.2, 1.05] }}
                    >
                        {modal}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
