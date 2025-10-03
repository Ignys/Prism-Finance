// src/firebase/userService.js
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebaseClient";

// Cria ou atualiza (não sobrescreve outros campos)
export async function setUserField(uid, fieldName, value) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { [fieldName]: value }, { merge: true });
}

// Atualiza somente se o documento já existir
export async function updateUserField(uid, fieldName, value) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { [fieldName]: value });
}
