// src/hooks/useAuthListener.js
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

export function useAuthListener() {
  const [user, setUser] = useState(null);
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true); // 🔹 garante que só renderiza depois do fetch

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // pega dados do Firestore
        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          if (data.finance.balance === undefined || data.finance.transactions === undefined) {
            setFinance({ balance: 0, despesas: 0, receitas: 0, transactions: [] });
          }
          setFinance(data.finance || { balance: 0, despesas: 0, receitas: 0, transactions: [] });
        } else {
          setFinance({ balance: 0, despesas: 0, receitas: 0, transactions: [] });
        }
      } else {
        setUser(null);
        setFinance(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { user, finance, setFinance, loading };
}
