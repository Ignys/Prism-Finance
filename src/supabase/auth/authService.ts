import type { Session, User } from "@supabase/supabase-js";
import type { AppUser } from "../../auth/appUser";
import { getSupabaseClient } from "../supabaseClient";

function asOptionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveProviderData(user: User): AppUser["providerData"] {
    const providerIds = new Set<string>();

    user.identities?.forEach((identity) => {
        if (identity.provider) {
            providerIds.add(identity.provider === "email" ? "password" : identity.provider);
        }
    });

    const providers = Array.isArray(user.app_metadata.providers) ? user.app_metadata.providers : [];
    providers.forEach((provider) => {
        if (typeof provider === "string" && provider.trim()) {
            providerIds.add(provider === "email" ? "password" : provider);
        }
    });

    if (providerIds.size === 0 && user.email) {
        providerIds.add("password");
    }

    return Array.from(providerIds).map((providerId) => ({ providerId }));
}

export function mapSupabaseUser(user: User | null | undefined): AppUser | null {
    if (!user) {
        return null;
    }

    return {
        uid: user.id,
        email: user.email?.trim() || null,
        displayName: asOptionalString(user.user_metadata.display_name) ?? asOptionalString(user.user_metadata.name),
        photoURL: asOptionalString(user.user_metadata.photo_url) ?? asOptionalString(user.user_metadata.avatar_url),
        providerData: resolveProviderData(user),
        metadata: {
            creationTime: user.created_at,
        },
    };
}

export function mapSupabaseSession(session: Session | null): AppUser | null {
    return mapSupabaseUser(session?.user);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
    const { error } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        throw error;
    }
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
    const { error } = await getSupabaseClient().auth.signUp({
        email,
        password,
    });

    if (error) {
        throw error;
    }
}

export async function signInWithGoogle(): Promise<void> {
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: window.location.origin,
            scopes: "openid email profile",
            queryParams: {
                prompt: "select_account",
            },
        },
    });

    if (error) {
        throw error;
    }
}

export async function signOutSupabase(): Promise<void> {
    const { error } = await getSupabaseClient().auth.signOut();

    if (error) {
        throw error;
    }
}

export async function updateSupabaseProfile(params: { displayName: string; photoURL: string | null; photoPublicId?: string | null }): Promise<AppUser | null> {
    const { data, error } = await getSupabaseClient().auth.updateUser({
        data: {
            display_name: params.displayName,
            name: params.displayName,
            photo_url: params.photoURL,
            avatar_url: params.photoURL,
            photo_public_id: params.photoPublicId ?? null,
        },
    });

    if (error) {
        throw error;
    }

    return mapSupabaseUser(data.user);
}

export async function updateSupabasePassword(params: { email: string; currentPassword: string; newPassword: string }): Promise<void> {
    await signInWithEmail(params.email, params.currentPassword);
    const { error } = await getSupabaseClient().auth.updateUser({
        password: params.newPassword,
    });

    if (error) {
        throw error;
    }
}

export async function setSupabasePassword(newPassword: string): Promise<void> {
    const { error } = await getSupabaseClient().auth.updateUser({
        password: newPassword,
    });

    if (error) {
        throw error;
    }
}

export async function sendSupabasePasswordReset(email: string): Promise<void> {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
    });

    if (error) {
        throw error;
    }
}
