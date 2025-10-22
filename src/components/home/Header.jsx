import { Ellipsis, Pencil, Plus } from "lucide-react";
import { useFinance } from "../../context/FinanceContext";

export function Header() {
    const { balance, despesas, receitas } = useFinance().finance;

    return (
        <header className="w-full mb-5 py-5 gap-5 flex justify-center border-b border-b-neutral-700">
            <BalanceBox text="Saldo atual" amount={balance} />
            <BalanceBox text="Receitas" amount={receitas} />
            <BalanceBox text="Despesas" amount={despesas} />
        </header>
    );
}

function BalanceBox({ text, amount, children }) {
    const isBalance = text === "Saldo atual";
    function buttonClick() {
        if (isBalance) {
            console.log("Editar saldo");
        } else if (text === "Receitas") {
            console.log("Adicionar receita");
        } else {
            console.log("Adicionar despesa");
        }
    }

    return (
        <div className="rounded-lg p-5 w-100 flex justify-between items-center bg-[#121212]">
            <h3 className="text-xl font-light">{text}</h3>
            <div className="flex items-center gap-3">
                <span className="text-2xl font-medium" style={isBalance ? { color: amount >= 0 ? "#4ade80" : "#f87171" } : {}}>
                    <span className=" font-light">R$</span> {amount.toFixed(2)}
                </span>
                <button className="bg-[#1a1a1a] rounded-full w-10 h-10 text-2xl flex items-center justify-center border-1 border-transparent hover:border-[#646cff] duration-200" >
                    {!isBalance
                    ? <Plus size={22}/>
                    : <Ellipsis size={22}/>}
                </button>
            </div>
        </div>
    );
}
