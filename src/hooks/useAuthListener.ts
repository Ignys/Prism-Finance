import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase/firebaseClient";
import { subscribeToAuthProfileUpdated } from "../lib/authProfileEvents";

export function useAuthListener() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileVersion, setProfileVersion] = useState(0);

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
        const unsubProfileRefresh = subscribeToAuthProfileUpdated(() => {
            setUser(auth.currentUser);
            setProfileVersion((current) => current + 1);
        });

        return () => {
            unsub();
            unsubProfileRefresh();
        };
    }, []);

    return { user, loading, profileVersion };
}
