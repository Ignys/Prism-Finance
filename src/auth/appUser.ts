export interface AppUserProviderData {
    providerId: string;
}

export interface AppUserMetadata {
    creationTime?: string;
}

export interface AppUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    providerData: AppUserProviderData[];
    metadata: AppUserMetadata;
}
