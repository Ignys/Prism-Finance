import { useEffect, useState } from "react";
import type { AppUser } from "../auth/appUser";
import { subscribeToAuthProfileUpdated } from "../lib/authProfileEvents";
import { mapSupabaseSession } from "../supabase/auth/authService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export const PASSWORD_RECOVERY_STORAGE_KEY = "prism:supabase-password-recovery";

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

            setUser(mapSupabaseSession(data.session));
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                window.localStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "true");
            }

            setUser(mapSupabaseSession(session));
            setLoading(false);
        });

        const unsubProfileRefresh = subscribeToAuthProfileUpdated(() => {
            void supabase.auth.getSession().then(({ data, error }) => {
                if (error) {
                    console.error("Falha ao atualizar perfil autenticado:", error);
                    return;
                }

                setUser(mapSupabaseSession(data.session));
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
