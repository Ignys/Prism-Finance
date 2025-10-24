import { createContext, useState, useContext } from 'react';

const ModalContext = createContext();

export function ModalProvider({ children }) {
    const [modal, setModal] = useState(null)
    const [data, setData] = useState(null)

    const openModal = (modalType, modalData = null) => {
        setModal(modalType);
        setData(modalData)
    }

    const closeModal = () => {
        setModal(null)
        setData(null)
    };

    const value = { modal, setModal, closeModal, openModal, setData, data };

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