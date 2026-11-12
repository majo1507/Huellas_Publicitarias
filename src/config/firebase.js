// ============================================================
// src/config/firebase.js — Configuración Cliente Firebase Authentication
// Proyecto: ORVEX (orvex-3c836)
// ============================================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'orvex-3c836.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'orvex-3c836',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'orvex-3c836.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.length > 10 &&
  firebaseConfig.apiKey !== 'tu_firebase_api_key'
);

let app = null;
let auth = null;
let googleProvider = null;

if (isConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    console.warn('⚠️ [Firebase] Error inicializando Firebase Client SDK:', err.message);
  }
} else {
  // Inicialización mock/dummy para evitar que la app crashee si aún no se han configurado las claves
  try {
    // Si hay un projectId válido, permitimos instanciar
    app = getApps().length ? getApp() : initializeApp({
      ...firebaseConfig,
      apiKey: firebaseConfig.apiKey || 'AIzaSyPlaceholderKeyForInitializationOnly',
    });
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  } catch (e) {
    // silencioso
  }
}

/**
 * Indica si Firebase Authentication tiene credenciales válidas en .env
 */
export function isFirebaseConfigured() {
  return isConfigured;
}

/**
 * Iniciar sesión con correo y contraseña en Firebase
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: import('firebase/auth').User, idToken: string }>}
 */
export async function loginWithEmailPassword(email, password) {
  if (!isConfigured) {
    throw new Error('Firebase Authentication no está configurado aún en el archivo .env del frontend.');
  }
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await credential.user.getIdToken();
  return { user: credential.user, idToken };
}

/**
 * Iniciar sesión con Google Popup en Firebase
 * @returns {Promise<{ user: import('firebase/auth').User, idToken: string }>}
 */
export async function loginWithGoogle() {
  if (!isConfigured) {
    throw new Error('Google Sign-In requiere configurar VITE_FIREBASE_API_KEY en el archivo .env.');
  }
  const credential = await signInWithPopup(auth, googleProvider);
  const idToken = await credential.user.getIdToken();
  return { user: credential.user, idToken };
}

/**
 * Enviar correo de restablecimiento de contraseña vía Firebase
 * @param {string} email
 */
export async function resetPassword(email) {
  if (!isConfigured) {
    throw new Error('La recuperación de contraseña requiere configurar las credenciales de Firebase en .env.');
  }
  return sendPasswordResetEmail(auth, email);
}

/**
 * Cerrar sesión en Firebase
 */
export async function logoutFirebase() {
  if (auth) {
    try {
      await signOut(auth);
    } catch (e) {
      // Ignorar errores al cerrar sesión
    }
  }
}

export { auth, googleProvider };
