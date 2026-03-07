import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebaseClient";

interface UserFieldUpdate {
    [key: string]: unknown;
}

export async function setUserField(uid: string, fieldName: string, value: unknown): Promise<void> {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { [fieldName]: value }, { merge: true });
}

export async function updateUserField(uid: string, fieldName: string, value: unknown): Promise<void> {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, { [fieldName]: value });
}

interface FinanceFieldsUpdate {
    wallets?: unknown[];
    transactions?: unknown[];
}

export async function mergeFinanceFields(uid: string, fields: FinanceFieldsUpdate): Promise<void> {
    const payload: UserFieldUpdate = {};

    if (fields.wallets) {
        payload["finance.wallets"] = fields.wallets;
    }

    if (fields.transactions) {
        payload["finance.transactions"] = fields.transactions;
    }

    if (Object.keys(payload).length === 0) {
        return;
    }

    const ref = doc(db, "users", uid);
    await setDoc(ref, payload, { merge: true });
}
