import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase/firebaseClient";

export function useAuthListener() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            try {
                if (firebaseUser) {
                    setUser(firebaseUser);
                } else {
                    setUser(null);
                }
            } finally {
                setLoading(false);
            }
        });

        return () => unsub();
    }, []);

    return { user, loading };
}
