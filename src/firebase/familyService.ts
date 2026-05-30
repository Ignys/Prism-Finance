import type { User } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import type { Beneficiary, Category, WishItem } from "../context/financeTypes";
import type {
    FamilyInvite,
    FamilyInviteStatus,
    FamilyMember,
    FamilyRole,
    FamilyStatus,
    FamilySummary,
    SharedWishlistItem,
    SharedWishlistSnapshot,
    UserFamilyMembership,
} from "../context/familyTypes";
import { normalizeWishItemPriority } from "../lib/wishlistPriority";
import { buildUserProfileData, resolveUserDisplayName, type UserProfileData } from "../lib/userProfile";
import { db } from "./firebaseClient";

export const MAX_FAMILY_MEMBERS = 5;

type LoadFamilyResult = {
    family: FamilySummary | null;
    sharedWishlists: SharedWishlistSnapshot[];
    sharedBeneficiaries: Beneficiary[];
};

interface UserAccountSnapshot {
    profile: UserProfileData;
    family: UserFamilyMembership;
}

interface FamilyDocumentShape {
    name: string;
    ownerUid: string;
    memberCount: number;
    members: FamilyMember[];
    invites: FamilyInvite[];
}

interface SharedFamilyBeneficiaryDocument {
    ownerUid: string;
    familyId: string;
    beneficiaryId: string;
    name: string;
    type: "person";
    avatarColor: string | null;
    avatarImage: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface SyncUserProfileOptions {
    displayName?: string | null;
    photoURL?: string | null;
    photoPublicId?: string | null;
}

interface SyncFamilyBeneficiaryOptions {
    profile?: UserProfileData | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function asTrimmedString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function asOptionalTrimmedString(value: unknown): string | null {
    const trimmed = asTrimmedString(value);
    return trimmed || null;
}

function isFamilyRole(value: unknown): value is FamilyRole {
    return value === "admin" || value === "member";
}

function isFamilyStatus(value: unknown): value is FamilyStatus {
    return value === "none" || value === "pending" || value === "active";
}

function isFamilyInviteStatus(value: unknown): value is FamilyInviteStatus {
    return value === "pending" || value === "accepted" || value === "cancelled";
}

function normalizeFamilyMembership(value: unknown): UserFamilyMembership {
    if (!isRecord(value)) {
        return {
            familyId: null,
            role: null,
            status: "none",
        };
    }

    const familyId = asOptionalTrimmedString(value.familyId);
    const role = isFamilyRole(value.role) ? value.role : null;
    const status = isFamilyStatus(value.status) ? value.status : familyId ? "pending" : "none";

    if (!familyId) {
        return {
            familyId: null,
            role: null,
            status: "none",
        };
    }

    return {
        familyId,
        role,
        status,
    };
}

function normalizeFamilyMember(value: unknown): FamilyMember | null {
    if (!isRecord(value)) {
        return null;
    }

    const uid = asTrimmedString(value.uid);
    const displayName = asTrimmedString(value.displayName) || "Usuario";
    const role = isFamilyRole(value.role) ? value.role : "member";
    const status = value.status === "pending" ? "pending" : "active";
    const joinedAt = asTrimmedString(value.joinedAt) || new Date().toISOString();

    if (!uid) {
        return null;
    }

    return {
        uid,
        displayName,
        email: asOptionalTrimmedString(value.email),
        role,
        status,
        joinedAt,
    };
}

function normalizeFamilyInvite(value: unknown): FamilyInvite | null {
    if (!isRecord(value)) {
        return null;
    }

    const inviteId = asTrimmedString(value.inviteId);
    const code = asTrimmedString(value.code);
    const createdBy = asTrimmedString(value.createdBy);
    const createdAt = asTrimmedString(value.createdAt) || new Date().toISOString();
    const status = isFamilyInviteStatus(value.status) ? value.status : "pending";

    if (!inviteId || !code || !createdBy) {
        return null;
    }

    return {
        inviteId,
        code,
        createdBy,
        status,
        createdAt,
        acceptedBy: asOptionalTrimmedString(value.acceptedBy),
    };
}

function normalizeFamilyDocument(id: string, value: unknown, currentUserUid: string): FamilySummary | null {
    if (!isRecord(value)) {
        return null;
    }

    const members = Array.isArray(value.members)
        ? value.members
              .map((member) => normalizeFamilyMember(member))
              .filter((member): member is FamilyMember => member !== null)
              .sort((a, b) => {
                  if (a.role !== b.role) {
                      return a.role === "admin" ? -1 : 1;
                  }
                  if (a.joinedAt === b.joinedAt) {
                      return a.displayName.localeCompare(b.displayName, "pt-BR");
                  }
                  return a.joinedAt.localeCompare(b.joinedAt);
              })
        : [];
    const invites = Array.isArray(value.invites)
        ? value.invites
              .map((invite) => normalizeFamilyInvite(invite))
              .filter((invite): invite is FamilyInvite => invite !== null)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.inviteId.localeCompare(a.inviteId))
        : [];
    const ownerUid = asTrimmedString(value.ownerUid);
    const memberCount = typeof value.memberCount === "number" && Number.isFinite(value.memberCount) ? Math.max(0, Math.floor(value.memberCount)) : members.length;
    const currentUserRole = members.find((member) => member.uid === currentUserUid)?.role ?? null;

    if (!ownerUid) {
        return null;
    }

    return {
        id,
        name: asTrimmedString(value.name) || "Familia Prism",
        ownerUid,
        memberCount,
        members,
        invites,
        currentUserRole,
        maxMembers: MAX_FAMILY_MEMBERS,
    };
}

function normalizeSharedWishlistItem(value: unknown): SharedWishlistItem | null {
    if (!isRecord(value)) {
        return null;
    }

    const id = asTrimmedString(value.id);
    const description = asTrimmedString(value.description);
    const createdAt = asTrimmedString(value.createdAt) || new Date().toISOString();
    const rawValue = Number(value.value);

    if (!id || !description || !Number.isFinite(rawValue)) {
        return null;
    }

    return {
        id,
        description,
        value: Number(rawValue.toFixed(2)),
        priority: normalizeWishItemPriority(value.priority),
        link: asOptionalTrimmedString(value.link),
        imageUrl: asOptionalTrimmedString(value.imageUrl),
        createdAt,
        isActive: value.isActive !== false,
        categoryLabel: asTrimmedString(value.categoryLabel) || "Categoria removida",
        categoryIcon: asTrimmedString(value.categoryIcon),
        categoryColor: asOptionalTrimmedString(value.categoryColor),
    };
}

function normalizeSharedWishlistSnapshot(value: unknown, currentUserUid: string): SharedWishlistSnapshot | null {
    if (!isRecord(value)) {
        return null;
    }

    const ownerUid = asTrimmedString(value.ownerUid);
    const ownerName = asTrimmedString(value.ownerName) || "Usuario";
    const updatedAt = asTrimmedString(value.updatedAt) || new Date().toISOString();

    if (!ownerUid) {
        return null;
    }

    const items = Array.isArray(value.items)
        ? value.items
              .map((item) => normalizeSharedWishlistItem(item))
              .filter((item): item is SharedWishlistItem => item !== null)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        : [];

    return {
        owner: {
            uid: ownerUid,
            name: ownerName,
            isCurrentUser: ownerUid === currentUserUid,
        },
        items,
        updatedAt,
    };
}

function buildFamilySharedBeneficiaryId(uid: string): string {
    return `family-beneficiary-self-${uid}`;
}

function normalizeSharedFamilyBeneficiary(value: unknown, currentUserUid: string): Beneficiary | null {
    if (!isRecord(value)) {
        return null;
    }

    const ownerUid = asTrimmedString(value.ownerUid);
    const familyId = asTrimmedString(value.familyId);
    const beneficiaryId = asTrimmedString(value.beneficiaryId) || buildFamilySharedBeneficiaryId(ownerUid);
    const name = asTrimmedString(value.name) || "Usuario";
    const createdAt = asTrimmedString(value.createdAt) || new Date().toISOString();

    if (!ownerUid || !familyId) {
        return null;
    }

    return {
        id: beneficiaryId,
        userId: ownerUid,
        familyId,
        source: ownerUid === currentUserUid ? "personal" : "family_shared",
        isSelfProfile: true,
        name,
        type: "person",
        avatarColor: asOptionalTrimmedString(value.avatarColor),
        avatarImage: asOptionalTrimmedString(value.avatarImage),
        isActive: value.isActive !== false,
        sortOrder: 10_000,
        createdAt,
    };
}

function buildFamilyName(user: User, customName?: string): string {
    const trimmedName = customName?.trim();
    if (trimmedName) {
        return trimmedName;
    }

    return `Familia de ${resolveUserDisplayName(user)}`;
}

function generateInviteCode(familyId: string, inviteId: string): string {
    const token = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${familyId}.${inviteId}.${token}`;
}

function normalizeInviteCode(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) {
        return "";
    }

    try {
        const parsedUrl = new URL(trimmed);
        const codeParam = parsedUrl.searchParams.get("code");
        if (codeParam?.trim()) {
            return codeParam.trim();
        }
    } catch {
        return trimmed;
    }

    return trimmed;
}

function parseInviteCode(input: string): { familyId: string; inviteId: string; code: string } | null {
    const normalizedInput = normalizeInviteCode(input);
    const segments = normalizedInput.split(".");
    if (segments.length < 3) {
        return null;
    }

    const familyId = segments[0]?.trim();
    const inviteId = segments[1]?.trim();
    if (!familyId || !inviteId) {
        return null;
    }

    return {
        familyId,
        inviteId,
        code: normalizedInput,
    };
}

function buildMemberFromUser(user: User, role: FamilyRole): FamilyMember {
    const profile = buildUserProfileData(user);
    return {
        uid: user.uid,
        displayName: profile.displayName,
        email: profile.email,
        role,
        status: "active",
        joinedAt: new Date().toISOString(),
    };
}

function mapWishlistItems(wishItems: WishItem[], categories: Category[]): SharedWishlistItem[] {
    const categoryMetaById = new Map(
        categories.map((category) => [
            category.id,
            {
                label: category.name,
                icon: category.icon,
                color: category.color,
            },
        ]),
    );

    return wishItems
        .map((item) => ({
            id: item.id,
            description: item.description,
            value: Number(item.value.toFixed(2)),
            priority: item.priority,
            link: item.link,
            imageUrl: item.imageUrl,
            createdAt: item.createdAt,
            isActive: item.isActive,
            categoryLabel: categoryMetaById.get(item.categoryId)?.label ?? "Categoria removida",
            categoryIcon: categoryMetaById.get(item.categoryId)?.icon ?? "",
            categoryColor: categoryMetaById.get(item.categoryId)?.color ?? null,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function readFamilyMembershipFromUserData(userData: unknown): UserFamilyMembership {
    if (!isRecord(userData)) {
        return {
            familyId: null,
            role: null,
            status: "none",
        };
    }

    return normalizeFamilyMembership(userData.family);
}

export async function syncUserProfileDocument(user: User, existingUserData?: unknown): Promise<UserAccountSnapshot> {
    let resolvedUserData = existingUserData;
    if (resolvedUserData === undefined) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        resolvedUserData = userSnap.exists() ? userSnap.data() : null;
    }

    const existingRecord = isRecord(resolvedUserData) ? resolvedUserData : {};
    const currentProfile = isRecord(existingRecord.profile) ? existingRecord.profile : {};
    const profile = buildUserProfileData(user, {
        currentProfile,
        preferCurrentProfilePhoto: true,
    });
    const family = readFamilyMembershipFromUserData(resolvedUserData);
    const profileChanged =
        asTrimmedString(currentProfile.displayName) !== profile.displayName ||
        asOptionalTrimmedString(currentProfile.email) !== profile.email ||
        asOptionalTrimmedString(currentProfile.photoURL) !== profile.photoURL ||
        asOptionalTrimmedString(currentProfile.photoPublicId) !== profile.photoPublicId;
    const familyChanged =
        !isRecord(existingRecord.family) ||
        asOptionalTrimmedString((existingRecord.family as Record<string, unknown>).familyId) !== family.familyId ||
        (isFamilyRole((existingRecord.family as Record<string, unknown>).role) ? (existingRecord.family as Record<string, unknown>).role : null) !== family.role ||
        (isFamilyStatus((existingRecord.family as Record<string, unknown>).status) ? (existingRecord.family as Record<string, unknown>).status : "none") !== family.status;

    if (profileChanged || familyChanged || !isRecord(resolvedUserData)) {
        await setDoc(
            doc(db, "users", user.uid),
            {
                profile,
                family,
            },
            { merge: true },
        );
    }

    return {
        profile,
        family,
    };
}

export async function syncUserProfileEverywhere(user: User, options: SyncUserProfileOptions = {}): Promise<UserAccountSnapshot> {
    const userRef = doc(db, "users", user.uid);
    let nextSnapshot: UserAccountSnapshot | null = null;

    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const rawUserData = userSnap.exists() ? userSnap.data() : null;
        const existingRecord = isRecord(rawUserData) ? rawUserData : {};
        const currentProfile = isRecord(existingRecord.profile) ? existingRecord.profile : {};
        const profile = buildUserProfileData(user, {
            currentProfile,
            displayName: options.displayName,
            photoURL: options.photoURL,
            photoPublicId: options.photoPublicId,
        });
        const family = readFamilyMembershipFromUserData(rawUserData);
        const familyRef = family.status === "active" && family.familyId ? doc(db, "families", family.familyId) : null;
        const familySnap = familyRef ? await transaction.get(familyRef) : null;
        const profileChanged =
            asTrimmedString(currentProfile.displayName) !== profile.displayName ||
            asOptionalTrimmedString(currentProfile.email) !== profile.email ||
            asOptionalTrimmedString(currentProfile.photoURL) !== profile.photoURL ||
            asOptionalTrimmedString(currentProfile.photoPublicId) !== profile.photoPublicId;

        if (family.status === "active" && family.familyId && familyRef && familySnap?.exists()) {
            const familySummary = normalizeFamilyDocument(familySnap.id, familySnap.data(), user.uid);
            if (familySummary) {
                const nextMembers = familySummary.members.map((member) =>
                    member.uid === user.uid
                        ? {
                              ...member,
                              displayName: profile.displayName,
                              email: profile.email,
                          }
                        : member,
                );
                const membersChanged = nextMembers.some((member, index) => {
                    const currentMember = familySummary.members[index];
                    return currentMember?.displayName !== member.displayName || currentMember?.email !== member.email;
                });

                if (membersChanged) {
                    transaction.update(familyRef, {
                        members: nextMembers,
                    });
                }
            }

            const now = new Date().toISOString();
            transaction.set(
                doc(db, "families", family.familyId, "wishlists", user.uid),
                {
                    ownerUid: user.uid,
                    ownerName: profile.displayName,
                    updatedAt: now,
                },
                { merge: true },
            );
            transaction.set(
                doc(db, "families", family.familyId, "beneficiaries", user.uid),
                {
                    ownerUid: user.uid,
                    familyId: family.familyId,
                    beneficiaryId: buildFamilySharedBeneficiaryId(user.uid),
                    name: profile.displayName,
                    type: "person",
                    avatarColor: "#4B5563",
                    avatarImage: profile.photoURL,
                    isActive: true,
                    createdAt: now,
                    updatedAt: now,
                },
                { merge: true },
            );
        }

        if (profileChanged || !isRecord(rawUserData)) {
            transaction.set(
                userRef,
                {
                    profile,
                    family,
                },
                { merge: true },
            );
        }

        nextSnapshot = {
            profile,
            family,
        };
    });

    if (!nextSnapshot) {
        throw new Error("Nao foi possivel sincronizar o perfil da conta.");
    }

    return nextSnapshot;
}

export async function loadFamilyState(user: User, existingUserData?: unknown): Promise<LoadFamilyResult> {
    const account = await syncUserProfileDocument(user, existingUserData);
    const membership = account.family;

    if (membership.status !== "active" || !membership.familyId) {
        return {
            family: null,
            sharedWishlists: [],
            sharedBeneficiaries: [],
        };
    }

    const familyRef = doc(db, "families", membership.familyId);
    const familySnap = await getDoc(familyRef);
    if (!familySnap.exists()) {
        return {
            family: null,
            sharedWishlists: [],
            sharedBeneficiaries: [],
        };
    }

    const family = normalizeFamilyDocument(familySnap.id, familySnap.data(), user.uid);
    if (!family) {
        return {
            family: null,
            sharedWishlists: [],
            sharedBeneficiaries: [],
        };
    }

    const wishlistsSnap = await getDocs(collection(familyRef, "wishlists"));
    const beneficiariesSnap = await getDocs(collection(familyRef, "beneficiaries"));
    const sharedWishlists = wishlistsSnap.docs
        .map((wishlistDoc) => normalizeSharedWishlistSnapshot(wishlistDoc.data(), user.uid))
        .filter((wishlist): wishlist is SharedWishlistSnapshot => wishlist !== null)
        .sort((a, b) => {
            if (a.owner.isCurrentUser !== b.owner.isCurrentUser) {
                return a.owner.isCurrentUser ? -1 : 1;
            }
            return a.owner.name.localeCompare(b.owner.name, "pt-BR");
        });
    const sharedBeneficiaries = beneficiariesSnap.docs
        .map((beneficiaryDoc) => normalizeSharedFamilyBeneficiary(beneficiaryDoc.data(), user.uid))
        .filter((beneficiary): beneficiary is Beneficiary => beneficiary !== null && beneficiary.userId !== user.uid)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));

    return {
        family,
        sharedWishlists,
        sharedBeneficiaries,
    };
}

export async function createFamily(user: User, familyName?: string): Promise<FamilySummary> {
    const familyId = uuidv4();
    const familyRef = doc(db, "families", familyId);
    const userRef = doc(db, "users", user.uid);
    const profile = buildUserProfileData(user);
    const member = buildMemberFromUser(user, "admin");
    const now = new Date().toISOString();
    const nextFamilyDocument: FamilyDocumentShape = {
        name: buildFamilyName(user, familyName),
        ownerUid: user.uid,
        memberCount: 1,
        members: [
            {
                ...member,
                joinedAt: now,
            },
        ],
        invites: [],
    };

    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const membership = readFamilyMembershipFromUserData(userSnap.exists() ? userSnap.data() : null);
        if (membership.familyId && membership.status !== "none") {
            throw new Error("Sua conta ja participa de uma familia.");
        }

        transaction.set(familyRef, nextFamilyDocument);
        transaction.set(
            userRef,
            {
                profile,
                family: {
                    familyId,
                    role: "admin",
                    status: "active",
                },
            },
            { merge: true },
        );
        transaction.set(doc(familyRef, "wishlists", user.uid), {
            ownerUid: user.uid,
            ownerName: profile.displayName,
            items: [],
            updatedAt: now,
        });
    });

    return {
        id: familyId,
        name: nextFamilyDocument.name,
        ownerUid: user.uid,
        memberCount: 1,
        members: nextFamilyDocument.members,
        invites: [],
        currentUserRole: "admin",
        maxMembers: MAX_FAMILY_MEMBERS,
    };
}

export async function generateFamilyInvite(familyId: string, adminUid: string): Promise<FamilyInvite> {
    const familyRef = doc(db, "families", familyId);
    const inviteId = uuidv4();
    const inviteCode = generateInviteCode(familyId, inviteId);
    const nextInvite: FamilyInvite = {
        inviteId,
        code: inviteCode,
        createdBy: adminUid,
        status: "pending",
        createdAt: new Date().toISOString(),
        acceptedBy: null,
    };

    await runTransaction(db, async (transaction) => {
        const familySnap = await transaction.get(familyRef);
        if (!familySnap.exists()) {
            throw new Error("Familia nao encontrada.");
        }

        const family = normalizeFamilyDocument(familySnap.id, familySnap.data(), adminUid);
        if (!family) {
            throw new Error("Familia invalida.");
        }

        const adminMember = family.members.find((member) => member.uid === adminUid && member.status === "active");
        if (!adminMember || adminMember.role !== "admin") {
            throw new Error("Somente o admin pode gerar convites.");
        }

        if (family.memberCount >= MAX_FAMILY_MEMBERS) {
            throw new Error("A familia ja atingiu o limite de membros.");
        }

        transaction.update(familyRef, {
            invites: [nextInvite, ...family.invites],
        });
    });

    return nextInvite;
}

export async function joinFamilyByCode(user: User, code: string): Promise<FamilySummary> {
    const parsedCode = parseInviteCode(code);
    if (!parsedCode) {
        throw new Error("Digite um codigo de convite valido.");
    }

    const familyRef = doc(db, "families", parsedCode.familyId);
    const userRef = doc(db, "users", user.uid);
    const wishlistRef = doc(familyRef, "wishlists", user.uid);
    const profile = buildUserProfileData(user);
    let nextFamilySummary: FamilySummary | null = null;

    await runTransaction(db, async (transaction) => {
        const [familySnap, userSnap] = await Promise.all([transaction.get(familyRef), transaction.get(userRef)]);
        const membership = readFamilyMembershipFromUserData(userSnap.exists() ? userSnap.data() : null);
        if (membership.familyId && membership.status !== "none") {
            throw new Error("Sua conta ja participa de uma familia.");
        }

        if (!familySnap.exists()) {
            throw new Error("Convite nao encontrado.");
        }

        const family = normalizeFamilyDocument(familySnap.id, familySnap.data(), user.uid);
        if (!family) {
            throw new Error("Familia invalida.");
        }

        if (family.memberCount >= MAX_FAMILY_MEMBERS) {
            throw new Error("A familia ja atingiu o limite de membros.");
        }

        const invite = family.invites.find((entry) => entry.inviteId === parsedCode.inviteId && entry.code === parsedCode.code);
        if (!invite || invite.status !== "pending") {
            throw new Error("Esse convite nao esta mais disponivel.");
        }

        const alreadyMember = family.members.some((member) => member.uid === user.uid && member.status === "active");
        if (alreadyMember) {
            throw new Error("Sua conta ja faz parte dessa familia.");
        }

        const joinedAt = new Date().toISOString();
        const nextMember: FamilyMember = {
            ...buildMemberFromUser(user, "member"),
            joinedAt,
        };
        const nextInvites = family.invites.map((entry) =>
            entry.inviteId === invite.inviteId
                ? {
                      ...entry,
                      status: "accepted" as const,
                      acceptedBy: user.uid,
                  }
                : entry,
        );
        const nextMembers = [...family.members, nextMember];
        const nextMemberCount = nextMembers.filter((member) => member.status === "active").length;

        transaction.update(familyRef, {
            members: nextMembers,
            invites: nextInvites,
            memberCount: nextMemberCount,
        });
        transaction.set(
            userRef,
            {
                profile,
                family: {
                    familyId: family.id,
                    role: "member",
                    status: "active",
                },
            },
            { merge: true },
        );
        transaction.set(wishlistRef, {
            ownerUid: user.uid,
            ownerName: profile.displayName,
            items: [],
            updatedAt: joinedAt,
        });

        nextFamilySummary = {
            ...family,
            members: nextMembers.sort((a, b) => {
                if (a.role !== b.role) {
                    return a.role === "admin" ? -1 : 1;
                }
                return a.joinedAt.localeCompare(b.joinedAt);
            }),
            invites: nextInvites.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.inviteId.localeCompare(a.inviteId)),
            memberCount: nextMemberCount,
            currentUserRole: "member",
        };
    });

    if (!nextFamilySummary) {
        throw new Error("Nao foi possivel entrar na familia.");
    }

    return nextFamilySummary;
}

export async function removeFamilyMember(familyId: string, adminUid: string, memberUid: string): Promise<FamilySummary> {
    const familyRef = doc(db, "families", familyId);
    const adminRef = doc(db, "users", adminUid);
    const memberRef = doc(db, "users", memberUid);
    const memberWishlistRef = doc(familyRef, "wishlists", memberUid);
    const memberBeneficiaryRef = doc(familyRef, "beneficiaries", memberUid);
    let nextFamilySummary: FamilySummary | null = null;

    await runTransaction(db, async (transaction) => {
        const [familySnap, adminSnap, memberSnap] = await Promise.all([transaction.get(familyRef), transaction.get(adminRef), transaction.get(memberRef)]);

        const adminMembership = readFamilyMembershipFromUserData(adminSnap.exists() ? adminSnap.data() : null);
        if (adminMembership.familyId !== familyId || adminMembership.role !== "admin" || adminMembership.status !== "active") {
            throw new Error("Somente o admin pode remover membros.");
        }

        if (!familySnap.exists()) {
            throw new Error("Familia nao encontrada.");
        }

        const family = normalizeFamilyDocument(familySnap.id, familySnap.data(), adminUid);
        if (!family) {
            throw new Error("Familia invalida.");
        }

        if (memberUid === family.ownerUid) {
            throw new Error("O admin principal nao pode ser removido.");
        }

        const targetMember = family.members.find((member) => member.uid === memberUid && member.status === "active");
        if (!targetMember) {
            throw new Error("Membro nao encontrado.");
        }

        const nextMembers = family.members.filter((member) => member.uid !== memberUid);
        const nextMemberCount = nextMembers.filter((member) => member.status === "active").length;

        transaction.update(familyRef, {
            members: nextMembers,
            memberCount: nextMemberCount,
        });
        transaction.set(
            memberRef,
            {
                family: {
                    familyId: null,
                    role: null,
                    status: "none",
                },
            },
            { merge: true },
        );
        if (memberSnap.exists()) {
            transaction.delete(memberWishlistRef);
            transaction.delete(memberBeneficiaryRef);
        }

        nextFamilySummary = {
            ...family,
            members: nextMembers,
            memberCount: nextMemberCount,
        };
    });

    if (!nextFamilySummary) {
        throw new Error("Nao foi possivel remover o membro.");
    }

    return nextFamilySummary;
}

export async function syncSharedWishlist(user: User, wishItems: WishItem[], categories: Category[], familyId: string): Promise<SharedWishlistSnapshot> {
    const profile = buildUserProfileData(user);
    const items = mapWishlistItems(wishItems, categories);
    const updatedAt = new Date().toISOString();

    await setDoc(doc(db, "families", familyId, "wishlists", user.uid), {
        ownerUid: user.uid,
        ownerName: profile.displayName,
        items,
        updatedAt,
    });

    return {
        owner: {
            uid: user.uid,
            name: profile.displayName,
            isCurrentUser: true,
        },
        items,
        updatedAt,
    };
}

export async function syncFamilyBeneficiary(user: User, beneficiary: Beneficiary, familyId: string, options: SyncFamilyBeneficiaryOptions = {}): Promise<Beneficiary> {
    const profile = options.profile ?? buildUserProfileData(user);
    const updatedAt = new Date().toISOString();
    const sharedBeneficiaryDocument: SharedFamilyBeneficiaryDocument = {
        ownerUid: user.uid,
        familyId,
        beneficiaryId: buildFamilySharedBeneficiaryId(user.uid),
        name: profile.displayName,
        type: "person",
        avatarColor: beneficiary.avatarColor ?? "#4B5563",
        avatarImage: profile.photoURL,
        isActive: true,
        createdAt: beneficiary.createdAt,
        updatedAt,
    };

    console.log(profile);
    await setDoc(doc(db, "families", familyId, "beneficiaries", user.uid), sharedBeneficiaryDocument);

    return {
        id: sharedBeneficiaryDocument.beneficiaryId,
        userId: user.uid,
        familyId,
        source: "personal",
        isSelfProfile: true,
        name: sharedBeneficiaryDocument.name,
        type: "person",
        avatarColor: sharedBeneficiaryDocument.avatarColor,
        avatarImage: sharedBeneficiaryDocument.avatarImage,
        isActive: true,
        sortOrder: beneficiary.sortOrder,
        createdAt: beneficiary.createdAt,
    };
}

export async function clearSharedWishlist(familyId: string, uid: string): Promise<void> {
    await deleteDoc(doc(db, "families", familyId, "wishlists", uid));
}
