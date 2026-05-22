export type FamilyRole = "admin" | "member";

export type FamilyStatus = "none" | "pending" | "active";

export type FamilyInviteStatus = "pending" | "accepted" | "cancelled";

export interface UserFamilyMembership {
    familyId: string | null;
    role: FamilyRole | null;
    status: FamilyStatus;
}

export interface FamilyMember {
    uid: string;
    displayName: string;
    email: string | null;
    role: FamilyRole;
    status: Extract<FamilyStatus, "active" | "pending">;
    joinedAt: string;
}

export interface FamilyInvite {
    inviteId: string;
    code: string;
    createdBy: string;
    status: FamilyInviteStatus;
    createdAt: string;
    acceptedBy: string | null;
}

export interface FamilySummary {
    id: string;
    name: string;
    ownerUid: string;
    memberCount: number;
    members: FamilyMember[];
    invites: FamilyInvite[];
    currentUserRole: FamilyRole | null;
    maxMembers: number;
}

export interface SharedWishlistItem {
    id: string;
    description: string;
    value: number;
    priority: 1 | 2 | 3;
    link: string | null;
    createdAt: string;
    isActive: boolean;
    categoryLabel: string;
    categoryIcon: string;
    categoryColor: string | null;
}

export interface SharedWishlistOwner {
    uid: string;
    name: string;
    isCurrentUser: boolean;
}

export interface SharedWishlistSnapshot {
    owner: SharedWishlistOwner;
    items: SharedWishlistItem[];
    updatedAt: string;
}
