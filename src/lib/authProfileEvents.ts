const AUTH_PROFILE_UPDATED_EVENT = "prism:auth-profile-updated";

export function dispatchAuthProfileUpdated(): void {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new CustomEvent(AUTH_PROFILE_UPDATED_EVENT));
}

export function subscribeToAuthProfileUpdated(callback: () => void): () => void {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    window.addEventListener(AUTH_PROFILE_UPDATED_EVENT, callback);
    return () => window.removeEventListener(AUTH_PROFILE_UPDATED_EVENT, callback);
}
