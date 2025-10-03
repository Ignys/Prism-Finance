// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCJW-NU2rzixsjHZYx7KfS_BZt92sSZOME",
  authDomain: "prism-project-app.firebaseapp.com",
  projectId: "prism-project-app",
  storageBucket: "prism-project-app.firebasestorage.app",
  messagingSenderId: "519381788863",
  appId: "1:519381788863:web:513a3f9733a65d61ab3e0a",
  measurementId: "G-QCBWD533HX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore()
export const auth = getAuth()