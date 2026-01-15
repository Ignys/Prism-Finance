import { createContext, useState, useContext, ReactNode } from 'react';

interface ModalContextType {
    modal: ReactNode | null;
    setModal: (modal: ReactNode | null) => void;
    closeModal: () => void;
    openModal: (modalType: ReactNode, modalData?: any) => void;
    setData: (data: any) => void;
    data: any;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [modal, setModal] = useState<ReactNode | null>(null)
    const [data, setData] = useState(null)

    const openModal = (modalType: ReactNode, modalData = null) => {
        setModal(modalType);
        setData(modalData)
    }

    const closeModal = () => {
        setModal(null)
        setData(null)
    };

    const value: ModalContextType = { modal, setModal, closeModal, openModal, setData, data };

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