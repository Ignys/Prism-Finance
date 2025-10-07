import { useFinance } from "../../context/FinanceContext";

export function Header() {
    const { balance, despesas, receitas } = useFinance().finance;

    return (
        <header className="w-full mb-5 py-5 gap-5 flex justify-center border-b border-b-neutral-700">
            {BalanceBox("Saldo atual", balance)}
            {BalanceBox("Receitas", receitas)}
            {BalanceBox("Despesas", despesas)}
        </header>
    );
}

function BalanceBox(text, amount) {
    const isBalance = text === "Saldo atual";
    return (
        <div className="rounded-lg p-5 w-100 flex justify-between items-center bg-[#121212]">
            <h3 className="text-xl font-light">{text}</h3>
            <span className="text-2xl font-medium" style={isBalance ? { color: amount >= 0 ? "#4ade80" : "#f87171" } : {}}>
                <span className=" font-light">R$</span> {amount.toFixed(2)}
            </span>
        </div>
    );
}
