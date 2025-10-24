// src/hooks/useAuthListener.js
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

export function useAuthListener() {
  const [user, setUser] = useState(null);
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // O listener é síncrono, mas o processamento dentro precisa ser aguardado manualmente
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      // marcamos loading como true toda vez que o estado mudar
      setLoading(true);

      (async () => {
        if (firebaseUser) {
          setUser(firebaseUser);

          try {
            const ref = doc(db, "users", firebaseUser.uid);
            const snap = await getDoc(ref);

            if (snap.exists()) {
              const data = snap.data();
              const financeData =
                data.finance && data.finance.balance !== undefined
                  ? data.finance
                  : { balance: 0, despesas: 0, receitas: 0, transactions: [] };

              setFinance(financeData);
            } else {
              // se o documento não existir
              setFinance({ balance: 0, despesas: 0, receitas: 0, transactions: [] });
            }
          } catch (error) {
            console.error("Erro ao buscar dados do Firestore:", error);
            setFinance({ balance: 0, despesas: 0, receitas: 0, transactions: [] });
          }
        } else {
          setUser(null);
          setFinance(null);
        }

        // 🔹 Só aqui, depois de TUDO concluído, tiramos o loading
        setLoading(false);
      })();
    });

    return () => unsub();
  }, []);

  return { user, finance, setFinance, loading };
}
