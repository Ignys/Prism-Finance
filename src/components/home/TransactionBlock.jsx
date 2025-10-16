import { format } from "date-fns";
import { CircleUserRound } from "lucide-react";

export function TransactionBlock({ transaction }) {
    return (
        <div className=" bg-[#1e1e1e] rounded-2xl p-4 flex items-center justify-between">
            <img className="w-18 rounded-full" src={`src/assets/${transaction.fonte.origem}.png`} alt="Logo do banco" />
            <div className="w-45 text-left">
                <h2 className="text-xl font-medium">{transaction.fonte.plataforma}</h2>
                <p className="text-lg">{transaction.descricao}</p>
                <p className="text-lg/1 flex items-center gap-1 text-neutral-300">
                    <CircleUserRound width={20} /> {transaction.beneficiario.para}
                </p>
            </div>
            <div className="w-45 text-right">
                <p className="text-xl font-medium">
                    <span className={transaction.tipo === "receita" ? "text-green-400" : "text-[#c44b4b]"}>R${transaction.valor.quantia.toFixed(2)}</span>
                </p>
                <p className="text-lg">{transaction.categoria.principal}</p>
                <p className="text-lg text-neutral-300">{format(new Date(transaction.data), "dd/MM/yyyy")}</p>
            </div>
            <div className="w-30 text-right">
                <p className="text-xl">{transaction.status}</p>
            </div>
        </div>
    );
}
