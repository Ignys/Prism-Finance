import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { AppUser } from "../auth/appUser";
import { subscribeToAuthProfileUpdated } from "../lib/authProfileEvents";
import { mapSupabaseSession } from "../supabase/auth/authService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export const PASSWORD_RECOVERY_STORAGE_KEY = "prism:supabase-password-recovery";

function areUsersEquivalent(currentUser: AppUser | null, nextUser: AppUser | null): boolean {
    if (currentUser === nextUser) {
        return true;
    }

    if (!currentUser || !nextUser) {
        return false;
    }

    return (
        currentUser.uid === nextUser.uid &&
        currentUser.email === nextUser.email &&
        currentUser.displayName === nextUser.displayName &&
        currentUser.photoURL === nextUser.photoURL &&
        currentUser.metadata.creationTime === nextUser.metadata.creationTime &&
        JSON.stringify(currentUser.providerData) === JSON.stringify(nextUser.providerData)
    );
}

function setUserIfChanged(setUser: Dispatch<SetStateAction<AppUser | null>>, nextUser: AppUser | null): void {
    setUser((currentUser) => (areUsersEquivalent(currentUser, nextUser) ? currentUser : nextUser));
}

export function useAuthListener() {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileVersion, setProfileVersion] = useState(0);

    useEffect(() => {
        const supabase = getSupabaseClient();
        setLoading(true);

        void supabase.auth.getSession().then(({ data, error }) => {
            if (error) {
                console.error("Falha ao carregar sessao Supabase:", error);
            }

            setUserIfChanged(setUser, mapSupabaseSession(data.session));
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                window.localStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "true");
            }

            setUserIfChanged(setUser, mapSupabaseSession(session));
            setLoading(false);
        });

        const unsubProfileRefresh = subscribeToAuthProfileUpdated(() => {
            void supabase.auth.getSession().then(({ data, error }) => {
                if (error) {
                    console.error("Falha ao atualizar perfil autenticado:", error);
                    return;
                }

                setUserIfChanged(setUser, mapSupabaseSession(data.session));
                setProfileVersion((current) => current + 1);
                setLoading(false);
            });
        });

        return () => {
            subscription.unsubscribe();
            unsubProfileRefresh();
        };
    }, []);

    return { user, loading, profileVersion };
}
