import { useModal } from "../../context/ModalContext"
import { EditTransaction } from "./EditTransaction"
import { AnimatePresence, motion } from "framer-motion";

export function DisplayModal() {
    const { modal, data } = useModal();

    return (
        <AnimatePresence>
            {modal && (
                <>
                    {/* Fundo escuro com fade */}
                    <motion.div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[5]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    />

                    {/* Conteúdo do modal */}
                    <motion.div
                        className="fixed inset-0 flex justify-center items-center z-10 text-white"
                        initial={{ opacity: 0, y: -300 }}
                        animate={{ opacity: 1, y: 0}}
                        exit={{ opacity: 0, y: 300 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                        {modal === "editTransaction" && <EditTransaction transaction={data}/>}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}