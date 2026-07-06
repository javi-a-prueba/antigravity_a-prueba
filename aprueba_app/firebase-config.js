/**
 * ══════════════════════════════════════════════════════════════════
 * firebase-config.js  –  Configuración y exportación de Firebase
 * ══════════════════════════════════════════════════════════════════
 * Centraliza la inicialización de Firebase para toda la aplicación.
 * Todos los módulos que necesiten Auth o Firestore deben importar
 * desde aquí, nunca inicializar Firebase de nuevo en otro archivo.
 *
 * Proyecto: aprueba-webapp (Firebase Console › aprueba-webapp)
 * SDK: Firebase v10 (ESM — importaciones de gstatic CDN)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";

// ── Auth ──────────────────────────────────────────────────────────
import {
    getAuth, GoogleAuthProvider,
    signInWithPopup, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// ── Firestore ─────────────────────────────────────────────────────
import {
    getFirestore, doc, setDoc, getDoc, updateDoc,
    collection, query, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ── Functions ─────────────────────────────────────────────────────
import {
    getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-functions.js";

// ── Configuración del proyecto ────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyDwBaUwQQ1uy2vyjPocjGttzrStAjUoNrM",
    authDomain: "aprueba-e7242.firebaseapp.com",
    projectId: "aprueba-e7242",
    storageBucket: "aprueba-e7242.firebasestorage.app",
    messagingSenderId: "686843190262",
    appId: "1:686843190262:web:1740f9aad9ff7f3c3b85d7",
    measurementId: "G-ZRDSY4R7FV"
};

// Inicializar App (singleton — solo se ejecuta una vez aunque se importe varias veces)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const functions = getFunctions(app); // Default region is us-central1

// ── Exportaciones ─────────────────────────────────────────────────
export {
    app,
    auth,
    googleProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    db,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    query,
    getDocs,
    where,
    functions,
    httpsCallable
};
