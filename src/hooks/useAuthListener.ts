// src/hooks/useAuthListener.js
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../firebase/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

interface Finance {
  balance: number;
  despesas: number;
  receitas: number;
  transactions: any[];
}

const defaultFinance: Finance = {
  balance: 0,
  despesas: 0,
  receitas: 0,
  transactions: []
};

export function useAuthListener() {
  const [user, setUser] = useState<User | null>(null);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);

          try {
            const ref = doc(db, "users", firebaseUser.uid);
            const snap = await getDoc(ref);

            if (snap.exists()) {
              const data = snap.data();
              const financeData: Finance =
                data.finance && data.finance.balance !== undefined
                  ? data.finance
                  : defaultFinance;

              setFinance(financeData);
            } else {
              setFinance(defaultFinance);
            }
          } catch (error) {
            console.error("Erro ao buscar dados do Firestore:", error);
            setFinance(defaultFinance);
          }
        } else {
          setUser(null);
          setFinance(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return { user, finance, setFinance, loading };
}
