import { useState, useEffect } from "react";
import prismLogo from "./assets/pngFinal.png";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/firebaseClient";
import { setUserField } from "./firebase/userService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase/firebaseClient";
import "./App.css";

function App() {
    const [userId, setUserId] = useState(null);
    const [price, setPrice] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [checked, setChecked] = useState(false);
    const [bank, setBank] = useState("C6Bank");
    const [category, setCategory] = useState("");
    const [subCategory, setSubCategory] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [time, setTime] = useState("");
    const [forWho, setForWho] = useState("");
    const [jsonResult, setJsonResult] = useState([]);

    // 🔹 Captura o usuário logado e carrega os dados do Firestore
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);

                // Tenta carregar dados existentes
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.finance) {
                        console.log("Finance importado do Firestore:", data.finance);
                        setJsonResult(data.finance);
                    }
                }
            } else {
                setUserId(null);
                setJsonResult([]); // limpa se deslogar
            }
        });

        return () => unsub();
    }, []);

    // 🔹 Sempre que jsonResult mudar, salva no Firestore
    useEffect(() => {
        if (userId) {
            setUserField(userId, "finance", jsonResult)
                .then(() => console.log("Campo 'finance' atualizado no Firestore!"))
                .catch((err) => console.error("Erro ao atualizar:", err));
        }
    }, [jsonResult]);

    const handleSubmit = () => {
        const transaction = {
            id: `${date}-${name || "transacao"}-${Math.floor(Math.random() * 1000)}`,
            tipo: price >= 0 ? "receita" : "despesa",
            valor: {
                quantia: Math.abs(parseFloat(price)),
                moeda: "BRL",
            },
            data: date || new Date().toISOString().split("T")[0],
            fonte: {
                plataforma: name,
                origem: bank,
            },
            categoria: {
                principal: category,
                subcategoria: subCategory || null,
            },
            beneficiario: {
                para: forWho || "Eu",
            },
            descricao: description,
            status: {
                pago: checked,
                liquidado: checked,
                pendente: !checked,
            },
            meta: {
                criado_em: new Date().toISOString(),
                atualizado_em: null,
                observacoes: [],
            },
        };
        setJsonResult((prev) => [...prev, transaction]);
    };

    return (
        <main className="justify-center text-center text-white">
            <div className="flex items-center justify-center">
                <img src={prismLogo} className="logo" alt="Prism logo" />
                <h1 className="">Prism Finance</h1>
            </div>

            <section className="flex items-center justify-center gap-5">
                <div className="p-10 bg-[#1e1e1e] rounded-2xl w-150">
                    <div className="flex flex-col gap-5 my-5 *:p-2 *:bg-neutral-900">
                        <input type="number" placeholder="Preço (use negativo para despesa)" value={price} onChange={(e) => setPrice(e.target.value)} />
                        <input type="text" placeholder="Nome (ex: Uber, iFood, Cliente X)" value={name} onChange={(e) => setName(e.target.value)} />
                        <textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
                        <select value={bank} onChange={(e) => setBank(e.target.value)}>
                            <option value="">Origem do dinheiro</option>
                            <option value="Nubank">Nubank</option>
                            <option value="C6Bank">C6Bank</option>
                            <option value="Carteira">Carteira</option>
                            <option value="Outros">Outros</option>
                        </select>
                        <input type="text" placeholder="Categoria (ex: Transporte, Alimentação)" value={category} onChange={(e) => setCategory(e.target.value)} />
                        <input type="text" placeholder="Subcategoria (opcional)" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
                        <input type="text" placeholder="Beneficiário (ex: Eu, Namorada)" value={forWho} onChange={(e) => setForWho(e.target.value)} />
                        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />

                        <label className="flex items-center gap-2 p-2 bg-neutral-900">
                            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                            Pago / Recebido
                        </label>
                    </div>
                    <button onClick={handleSubmit} className="bg-green-600 px-4 py-2 rounded-lg hover:bg-green-700">
                        Submit
                    </button>
                </div>

                <div className="p-5 rounded-2xl w-1/3 h-auto text-left">{jsonResult.length ? jsonResult.map((transaction) => TransactionBlock(transaction)) : <p>Nenhuma transação salva ainda.</p>}</div>
            </section>
        </main>
    );
}

function TransactionBlock(transaction) {
    return (
        <div className="mt-5 bg-[#1e1e1e] rounded-2xl p-4 flex items-center justify-between">
            <img className="w-20 rounded-full" src={`src/assets/${transaction.fonte.origem}.png`} alt="Logo do banco" />
            <div className="w-30">
                <h2 className="text-2xl font-bold">{transaction.fonte.plataforma}</h2>
                <p className="text-lg">{transaction.descricao}</p>
                <p className="text-lg ">
                    <span className={transaction.tipo === "receita" ? "text-green-400" : "text-red-400"}>R${transaction.valor.quantia.toFixed(2)}</span>
                </p>
            </div>
            <div className="w-30">
                <p className="text-lg">{transaction.beneficiario.para}</p>
                <p className="text-lg">{transaction.categoria.principal}</p>
                <p className="text-lg">{transaction.data}</p>
            </div>
        </div>
    );
}

export default App;
