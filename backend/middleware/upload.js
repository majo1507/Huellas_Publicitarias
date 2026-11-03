// ============================================================
// middleware/upload.js — Configuración de Multer para Artes
// ============================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
  const extensionesPermitidas = /pdf|png|jpg|jpeg|svg|ai|psd|cdr|tiff|zip|rar/i;
  const extname = extensionesPermitidas.test(path.extname(file.originalname).toLowerCase());

  if (extname) {
    return cb(null, true);
  }
  cb(new Error('Formato de archivo no admitido. Formatos válidos: PDF, PNG, JPG, SVG, AI, PSD, CDR, TIFF, ZIP, RAR.'));
};

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Límite de 100 MB para archivos de gran formato
  },
  fileFilter,
});

module.exports = upload;
