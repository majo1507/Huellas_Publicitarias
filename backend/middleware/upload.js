// ============================================================
// middleware/upload.js — Configuración de Multer para Artes
// ============================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { EXTENSIONES_PERMITIDAS, MIME_PERMITIDOS_POR_EXT } = require('../utils/validacionesArchivo');

// Asegurar que la carpeta uploads exista
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento en disco
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ordenId = req.params.orden_id || 'general';
    const timestamp = Date.now();
    // Limpiar nombre original de caracteres no válidos
    const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `orden_${ordenId}_${timestamp}_${cleanOriginalName}`;
    cb(null, filename);
  },
});

// Filtro de formatos permitidos en producción publicitaria
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

  // 1. Lista blanca exacta de extensiones sin coincidencias parciales
  if (!ext || !EXTENSIONES_PERMITIDAS.includes(ext)) {
    return cb(
      new Error(
        `Formato de archivo .${ext || 'desconocido'} no admitido. Formatos válidos: ${EXTENSIONES_PERMITIDAS.map((e) => e.toUpperCase()).join(', ')}.`
      )
    );
  }

  // 2. Validación de tipo MIME declarado
  const mimesPermitidos = MIME_PERMITIDOS_POR_EXT[ext] || [];
  const clientMime = String(file.mimetype || '').toLowerCase();
  if (clientMime && mimesPermitidos.length > 0 && !mimesPermitidos.includes(clientMime)) {
    return cb(
      new Error(
        `Tipo MIME "${clientMime}" incompatible con la extensión .${ext}. Archivo rechazado por seguridad.`
      )
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Límite de 100 MB para archivos de gran formato
  },
  fileFilter,
});

module.exports = upload;
