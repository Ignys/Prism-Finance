import { Ellipsis, Plus } from "lucide-react";
import { useFinance } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { AddIncome } from "../modal/AddIncome";
import { AddSpending } from "../modal/AddSpending";
import { BalanceModal } from "../modal/BalanceModal";

export function Header() {
    const finance = useFinance().finance;
    const { balance, despesas, receitas } = finance || { balance: 0, despesas: 0, receitas: 0 };

    return (
        <header className="">
            <a href="/home">
                <div className="flex items-center justify-center">
                    <img src={"pngFinal.png"} className="logo h-[6em]" alt="Prism logo" />
                    <h1 className="font-medium text-4xl uppercase">Prism Finance</h1>
                </div>
            </a>
            <div className="w-full mb-3 py-3 gap-5 flex justify-center border-b border-b-neutral-700">
                <BalanceBox text="Saldo atual" amount={balance} page="/balance" modal={<BalanceModal />} />
                <BalanceBox text="Receitas" amount={receitas} page="/income" modal={<AddIncome />} />
                <BalanceBox text="Despesas" amount={despesas} page="/spending" modal={<AddSpending />} />
                <BalanceBox text="Fatura" amount={despesas} page="/credit_card" modal={<AddSpending />} />
            </div>
        </header>
    );
}

function BalanceBox({ text, amount, modal, page }: { text: string; amount: number; modal: React.ReactNode; page: string }) {
    const { openModal } = useModal();
    const isBalance = text === "Saldo atual";
    const thisModal = () => {
        openModal(modal);
    };
    return (
        <div className="rounded-lg p-3 w-70 flex justify-between items-center bg-[#121212]">
            <div className="flex flex-col items-start">
                <a href={page}>
                    <h3 className="text-base font-light hover:text-white text-neutral-400 transition-all duration-100 cursor-pointer">{text}</h3>
                </a>
                <span className="text-xl font-medium" style={isBalance ? { color: amount >= 0 ? "#4ade80" : "#f87171" } : {}}>
                    <span className=" font-light">R$</span> {amount.toFixed(2)}
                </span>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={thisModal} className="bg-[#1a1a1a] rounded-full w-10 h-10 text-2xl flex items-center justify-center border-1 border-transparent hover:border-[#b964ff] duration-200">
                    {!isBalance ? <Plus size={22} /> : <Ellipsis size={22} />}
                </button>
            </div>
        </div>
    );
}
