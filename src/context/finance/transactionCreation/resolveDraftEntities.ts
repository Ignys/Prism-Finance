import type { Beneficiary, Category, FinanceSnapshot, TransactionDraft, TransactionGroupType } from "../domainTypes";
import { DEFAULT_BENEFICIARY_NAME, normalizeCategory, normalizeBeneficiary, findDefaultCategoryId } from "../financeCore";
import { createId, findCategoryByName, findBeneficiaryByName, findCurrentUserSelfBeneficiary, toCategoryTypeFromGroupType } from "../helpers";
import { getNextSortOrder } from "../registryOrdering";
import { getDefaultCategoryIconName } from "../../../lib/categoryIcons";

export function resolveDraftEntities(snapshot: FinanceSnapshot, newTransaction: TransactionDraft, groupType: TransactionGroupType, nowIso: string, userId: string | null, displayName: string) {
    const categoryType = toCategoryTypeFromGroupType(groupType);

    let nextCategories = [...snapshot.categories];
    let nextBeneficiaries = [...snapshot.beneficiaries];

    const categoriesById = new Map(nextCategories.map((item) => [item.id, item]));
    const beneficiariesById = new Map(nextBeneficiaries.map((item) => [item.id, item]));

    const createCategory = (name: string, parentId: string | null) => {
        const category = normalizeCategory({
            id: createId("category"),
            userId: userId ?? null,
            parentId,
            name,
            type: categoryType,
            icon: getDefaultCategoryIconName(categoryType),
            color: null,
            isActive: true,
            isSystem: false,
            sortOrder: getNextSortOrder(nextCategories.filter((item) => item.parentId === parentId && item.type === categoryType)),
            createdAt: nowIso,
        });
        nextCategories = [...nextCategories, category];
        categoriesById.set(category.id, category);
        return category;
    };

    let finalCategory: Category | null = null;
    const draftCategoryId = newTransaction.categoryId ? newTransaction.categoryId.trim() : "";
    if (draftCategoryId) {
        const existing = categoriesById.get(draftCategoryId);
        if (existing && existing.type === categoryType) {
            finalCategory = existing;
        }
    }

    if (!finalCategory) {
        const principal = newTransaction.category?.principal?.trim();
        const sub = newTransaction.category?.sub?.trim();
        if (principal) {
            const root = findCategoryByName(nextCategories, categoryType, principal, null) ?? createCategory(principal, null);
            finalCategory = sub ? findCategoryByName(nextCategories, categoryType, sub, root.id) ?? createCategory(sub, root.id) : root;
        }
    }

    if (!finalCategory) {
        const fallbackId = findDefaultCategoryId(groupType, nextCategories);
        finalCategory = categoriesById.get(fallbackId) ?? null;
    }

    if (!finalCategory) {
        finalCategory = createCategory("Sem categoria", null);
    }

    const parentCategory = finalCategory.parentId ? categoriesById.get(finalCategory.parentId) : null;
    const categoryName = parentCategory?.name ?? finalCategory.name;
    const subcategoryName = parentCategory ? finalCategory.name : null;

    const createBeneficiary = (name: string) => {
        const beneficiary = normalizeBeneficiary({
            id: createId("beneficiary"),
            userId: userId ?? null,
            name,
            type: "person",
            avatarColor: null,
            isActive: true,
            sortOrder: getNextSortOrder(nextBeneficiaries),
            createdAt: nowIso,
        });
        nextBeneficiaries = [...nextBeneficiaries, beneficiary];
        beneficiariesById.set(beneficiary.id, beneficiary);
        return beneficiary;
    };

    let finalBeneficiary: Beneficiary | null = null;
    const draftBeneficiaryId = newTransaction.beneficiaryId ? newTransaction.beneficiaryId.trim() : "";
    if (draftBeneficiaryId) {
        finalBeneficiary = beneficiariesById.get(draftBeneficiaryId) ?? null;
    }

    if (!finalBeneficiary) {
        const beneficiaryName = newTransaction.beneficiary?.trim();
        if (beneficiaryName) {
            finalBeneficiary = findBeneficiaryByName(nextBeneficiaries, beneficiaryName) ?? createBeneficiary(beneficiaryName);
        }
    }

    if (!finalBeneficiary) {
        finalBeneficiary =
            findCurrentUserSelfBeneficiary(nextBeneficiaries, userId) ??
            findBeneficiaryByName(nextBeneficiaries, DEFAULT_BENEFICIARY_NAME) ??
            createBeneficiary(displayName);
    }

    return { finalCategory, finalBeneficiary, categoryName, subcategoryName, nextCategories, nextBeneficiaries };
}
