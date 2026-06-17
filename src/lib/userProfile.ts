import type { AppUser } from "../auth/appUser";

export interface UserProfileData {
    displayName: string;
    email: string | null;
    photoURL: string | null;
    photoPublicId: string | null;
}

interface UserProfileLike {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
}

export function resolveUserDisplayName(user: UserProfileLike | null | undefined): string {
    const displayName = user?.displayName?.trim();
    if (displayName) {
        return displayName;
    }

    const emailPrefix = user?.email?.split("@")[0]?.trim();
    if (emailPrefix) {
        return emailPrefix;
    }

    return "Usuario";
}

function asOptionalTrimmedString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

interface BuildUserProfileOptions {
    currentProfile?: unknown;
    displayName?: string | null;
    photoURL?: string | null;
    photoPublicId?: string | null;
    preferCurrentProfilePhoto?: boolean;
}

export function buildUserProfileData(user: AppUser, options: BuildUserProfileOptions = {}): UserProfileData {
    const currentProfile = typeof options.currentProfile === "object" && options.currentProfile !== null ? (options.currentProfile as Record<string, unknown>) : null;
    const resolvedDisplayName = asOptionalTrimmedString(options.displayName) ?? resolveUserDisplayName(user);
    const resolvedPhotoURL =
        options.photoURL !== undefined
            ? asOptionalTrimmedString(options.photoURL)
            : options.preferCurrentProfilePhoto && currentProfile && Object.prototype.hasOwnProperty.call(currentProfile, "photoURL")
              ? asOptionalTrimmedString(currentProfile.photoURL)
              : user.photoURL?.trim() || null;

    return {
        displayName: resolvedDisplayName,
        email: user.email?.trim() || null,
        photoURL: resolvedPhotoURL,
        photoPublicId: options.photoPublicId !== undefined ? asOptionalTrimmedString(options.photoPublicId) : asOptionalTrimmedString(currentProfile?.photoPublicId),
    };
}
