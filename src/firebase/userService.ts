// src/firebase/userService.js
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebaseClient";

// Cria ou atualiza (não sobrescreve outros campos)
interface UserFieldUpdate {
  [key: string]: unknown;
}

export async function setUserField(uid: string, fieldName: string, value: unknown): Promise<void> {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { [fieldName]: value }, { merge: true });
}

// Atualiza somente se o documento já existir
export async function updateUserField(uid: string, fieldName: string, value: unknown): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { [fieldName]: value });
}
