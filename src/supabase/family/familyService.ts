import type { FamilyInvite, FamilyMember, FamilySummary, SharedWishlistSnapshot } from "../../context/familyTypes";
import { getSupabaseClient } from "../supabaseClient";

interface FamilyMemberRow {
    user_id: string;
    display_name: string;
    email: string | null;
    role: FamilyMember["role"];
    status: FamilyMember["status"];
    joined_at: string;
}

interface FamilyInviteRow {
    id: string;
    code: string;
    created_by: string;
    status: FamilyInvite["status"];
    created_at: string;
    accepted_by: string | null;
}

interface FamilySummaryRow {
    id: string;
    name: string;
    owner_user_id: string;
    member_count: number;
    max_members: number;
    current_user_role: FamilySummary["currentUserRole"];
    members: FamilyMemberRow[];
    invites: FamilyInviteRow[];
}

interface SharedWishlistRow {
    owner: { uid: string; name: string; is_current_user: boolean };
    items: Array<{
        id: string;
        description: string;
        value: number | string;
        priority: number | string;
        link: string | null;
        image_url: string | null;
        created_at: string;
        is_active: boolean;
        category_label: string;
        category_icon: string;
        category_color: string | null;
    }>;
    updated_at: string;
}

interface FamilyContextRow {
    family: FamilySummaryRow;
    shared_wishlists: SharedWishlistRow[];
}

export interface SupabaseFamilyContext {
    family: FamilySummary | null;
    sharedWishlists: SharedWishlistSnapshot[];
}

function throwRpcError(error: Error | null): void {
    if (error) {
        throw error;
    }
}

function fromMemberRow(row: FamilyMemberRow): FamilyMember {
    return {
        uid: row.user_id,
        displayName: row.display_name,
        email: row.email,
        role: row.role,
        status: row.status,
        joinedAt: row.joined_at,
    };
}

function fromInviteRow(row: FamilyInviteRow): FamilyInvite {
    return {
        inviteId: row.id,
        code: row.code,
        createdBy: row.created_by,
        status: row.status,
        createdAt: row.created_at,
        acceptedBy: row.accepted_by,
    };
}

function fromFamilyRow(row: FamilySummaryRow): FamilySummary {
    return {
        id: row.id,
        name: row.name,
        ownerUid: row.owner_user_id,
        memberCount: row.member_count,
        currentUserRole: row.current_user_role,
        members: (row.members ?? []).map(fromMemberRow),
        invites: (row.invites ?? []).map(fromInviteRow),
        maxMembers: row.max_members,
    };
}

function normalizeSharedPriority(value: number | string): 1 | 2 | 3 {
    const priority = Number(value);
    return priority === 1 || priority === 2 || priority === 3 ? priority : 2;
}

function fromSharedWishlistRow(row: SharedWishlistRow): SharedWishlistSnapshot {
    return {
        owner: { uid: row.owner.uid, name: row.owner.name, isCurrentUser: row.owner.is_current_user },
        items: (row.items ?? []).map((item) => ({
            id: item.id,
            description: item.description,
            value: Number(item.value) || 0,
            priority: normalizeSharedPriority(item.priority),
            link: item.link,
            imageUrl: item.image_url,
            createdAt: item.created_at,
            isActive: item.is_active,
            categoryLabel: item.category_label,
            categoryIcon: item.category_icon,
            categoryColor: item.category_color,
        })),
        updatedAt: row.updated_at,
    };
}

export async function loadCurrentFamily(): Promise<FamilySummary | null> {
    const result = await getSupabaseClient().rpc("get_current_family");
    throwRpcError(result.error);
    const row = result.data as FamilySummaryRow | null;
    if (!row) {
        return null;
    }

    return fromFamilyRow(row);
}

export async function loadCurrentFamilyContext(): Promise<SupabaseFamilyContext> {
    const result = await getSupabaseClient().rpc("get_current_family_context");
    throwRpcError(result.error);
    const row = result.data as FamilyContextRow | null;
    if (!row?.family) {
        return { family: null, sharedWishlists: [] };
    }

    return {
        family: fromFamilyRow(row.family),
        sharedWishlists: (row.shared_wishlists ?? []).map(fromSharedWishlistRow),
    };
}

export async function createSupabaseFamily(name?: string): Promise<string> {
    const result = await getSupabaseClient().rpc("create_family", { family_name: name ?? null });
    throwRpcError(result.error);
    return String(result.data);
}

export async function createSupabaseFamilyInvite(familyId: string): Promise<FamilyInvite> {
    const result = await getSupabaseClient().rpc("create_family_invite", { target_family_id: familyId, ttl_hours: 168 });
    throwRpcError(result.error);
    const data = result.data as { invite_id: string; code: string; expires_at: string };
    return {
        inviteId: data.invite_id,
        code: data.code,
        createdBy: "",
        status: "pending",
        createdAt: new Date().toISOString(),
        acceptedBy: null,
    };
}

export async function acceptSupabaseFamilyInvite(code: string): Promise<string> {
    const result = await getSupabaseClient().rpc("accept_family_invite", { invite_code: code });
    throwRpcError(result.error);
    return String(result.data);
}

export async function removeSupabaseFamilyMember(familyId: string, userId: string): Promise<void> {
    const result = await getSupabaseClient().rpc("remove_family_member", {
        target_family_id: familyId,
        target_user_id: userId,
    });
    throwRpcError(result.error);
}
