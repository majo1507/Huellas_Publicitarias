// ============================================================
// config/firebaseAdmin.js — Inicialización de Firebase Admin SDK
// ============================================================
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

let firebaseApp = null;
let inicializado = false;

function obtenerCert(datos) {
  if (typeof admin.cert === 'function') {
    return admin.cert(datos);
  }
  if (admin.credential && typeof admin.credential.cert === 'function') {
    return admin.credential.cert(datos);
  }
  throw new Error('Método cert no disponible en la versión de firebase-admin instalada.');
}

function inicializarFirebaseAdmin() {
  if (inicializado && firebaseApp) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orvex-3c836';
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  try {
    // 1. Prioridad: Archivo JSON de Service Account explícito (e.g., backend/config/firebase-service-account.json)
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      firebaseApp = admin.initializeApp({
        credential: obtenerCert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      inicializado = true;
      console.log('🔥 [FirebaseAdmin] Inicializado con Service Account desde:', serviceAccountPath);
      return admin;
    }

    // Ruta por defecto si el archivo fue colocado en backend/config/firebase-service-account.json
    const defaultPath = path.join(__dirname, 'firebase-service-account.json');
    if (fs.existsSync(defaultPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
      firebaseApp = admin.initializeApp({
        credential: obtenerCert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      inicializado = true;
      console.log('🔥 [FirebaseAdmin] Inicializado exitosamente con:', defaultPath, `(${serviceAccount.client_email})`);
      return admin;
    }

    // 2. Variables de entorno directas
    if (clientEmail && privateKey) {
      firebaseApp = admin.initializeApp({
        credential: obtenerCert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
      inicializado = true;
      console.log('🔥 [FirebaseAdmin] Inicializado con variables de entorno para:', clientEmail);
      return admin;
    }

    // 3. Fallback a Application Default Credentials (si está en GCP o GOOGLE_APPLICATION_CREDENTIALS)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
      inicializado = true;
      console.log('🔥 [FirebaseAdmin] Inicializado con GOOGLE_APPLICATION_CREDENTIALS');
      return admin;
    }

    // 4. Si solo tenemos el projectId definido (modo verificación con projectId)
    if (projectId) {
      firebaseApp = admin.initializeApp({
        projectId,
      });
      inicializado = true;
      console.log('🔥 [FirebaseAdmin] Inicializado con Project ID:', projectId, '(Sin credenciales de Service Account privadas aún)');
      return admin;
    }
  } catch (err) {
    console.warn('⚠️ [FirebaseAdmin] Advertencia al inicializar Firebase Admin SDK:', err.message);
  }

  return admin;
}

// Intentar inicialización temprana
try {
  inicializarFirebaseAdmin();
} catch (e) {
  // Ignorar advertencia en arranque; se reintentará en verificación
}

/**
 * Verifica un Firebase ID Token emitido al cliente
 * @param {string} idToken
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
async function verificarIdTokenFirebase(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('ID Token de Firebase no proporcionado o formato inválido.');
  }

  inicializarFirebaseAdmin();

  try {
    const auth = getAuth(firebaseApp || admin.getApp());
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    console.error('❌ [FirebaseAdmin] Error al verificar ID Token de Firebase:', err.message);
    throw new Error(`Token de Firebase inválido o expirado: ${err.message}`);
  }
}

function isFirebaseAdminConfigured() {
  return inicializado;
}

module.exports = {
  admin,
  verificarIdTokenFirebase,
  isFirebaseAdminConfigured,
  inicializarFirebaseAdmin,
};
