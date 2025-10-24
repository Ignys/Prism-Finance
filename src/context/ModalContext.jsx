import { createContext, useState, useContext } from 'react';

const ModalContext = createContext();

export function ModalProvider({ children }) {
    const [modal, setModal] = useState(null)

    const openModal = (modalType) => setModal(modalType);

    const closeModal = () => setModal(null);

    const value = { modal, setModal, closeModal, openModal };

    return (
        <ModalContext.Provider value={value}>
            {children}
        </ModalContext.Provider>
    );
}

export function useModal() {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
}