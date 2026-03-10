import type { TransactionType } from "../../context/FinanceContext";
import { TransactionForm } from "../transactions/TransactionForm";

export function CreateTransaction({ type }: { type?: TransactionType }) {
    return <TransactionForm type={type} />;
}
