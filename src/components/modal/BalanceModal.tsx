import { type Wallet } from "../../context/FinanceContext";
import { ModalStructure } from "./ModalStructure";
import { AddWallet } from "./AddWallet";

interface BalanceModalProps {
    mode?: "create" | "edit";
    walletId?: string;
    initialWallet?: Wallet;
}

export function BalanceModal({ mode = "create", walletId, initialWallet }: BalanceModalProps) {
    return (
        <ModalStructure height="auto" width="620px">
            <AddWallet mode={mode} walletId={walletId} initialWallet={initialWallet} />
        </ModalStructure>
    );
}
