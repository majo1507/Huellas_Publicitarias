// ============================================================
// utils/validacionesArchivo.js — Validación física, MIME, firma, serialización atómica y separación de contextos
// ============================================================
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Lista blanca estricta de extensiones permitidas en producción publicitaria
const EXTENSIONES_PERMITIDAS = ['pdf', 'png', 'jpg', 'jpeg', 'svg', 'ai', 'psd', 'cdr', 'tiff', 'zip', 'rar'];

// Mapa de tipos MIME autorizados por extensión para evitar suplantaciones
const MIME_PERMITIDOS_POR_EXT = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  svg: ['image/svg+xml', 'text/xml', 'application/xml', 'image/svg'],
  ai: ['application/postscript', 'application/pdf', 'application/illustrator', 'application/vnd.adobe.illustrator', 'application/octet-stream'],
  psd: ['image/vnd.adobe.photoshop', 'application/x-photoshop', 'image/photoshop', 'application/photoshop', 'application/psd', 'image/psd', 'application/octet-stream'],
  cdr: ['application/coreldraw', 'application/x-cdr', 'application/x-coreldraw', 'image/cdr', 'application/octet-stream'],
  tiff: ['image/tiff', 'image/x-tiff'],
  zip: ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip', 'application/x-compressed', 'application/octet-stream'],
  rar: ['application/vnd.rar', 'application/x-rar-compressed', 'application/x-rar', 'application/octet-stream'],
};

/**
 * Calcula el hash SHA-256 del contenido del archivo físico
 * @param {string} rutaFisica
 * @returns {string|null}
 */
function calcularHashSha256(rutaFisica) {
  try {
    const data = fs.readFileSync(rutaFisica);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch (_) {
    return null;
  }
}

/**
 * Comprueba la firma de bytes (magic numbers) del archivo físico para verificar
 * la coherencia entre el contenido real y la extensión declarada.
 *
 * @param {string} rutaArchivo - Ruta física del archivo en disco
 * @param {string} ext - Extensión normalizada sin punto
 * @returns {{ valido: boolean, error?: string }}
 */
function verificarFirmaContenido(rutaArchivo, ext) {
  try {
    const fd = fs.openSync(rutaArchivo, 'r');
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) {
      return { valido: false, error: 'El archivo está vacío o corrupto.' };
    }

    // Detección inmediata de ejecutables peligrosos camuflados
    // 'MZ' (Windows PE / EXE / DLL)
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
      return { valido: false, error: 'Archivo ejecutable camuflado detectado. Formato rechazado por seguridad.' };
    }
    // 'ELF' (Linux binary)
    if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
      return { valido: false, error: 'Binario ejecutable no permitido.' };
    }

    const extLower = ext.toLowerCase();

    if (extLower === 'pdf') {
      const headerStr = buffer.slice(0, 1024).toString('latin1');
      if (!headerStr.includes('%PDF-')) {
        return { valido: false, error: 'El contenido del archivo no corresponde a un documento PDF válido (%PDF- no encontrado).' };
      }
    } else if (extLower === 'png') {
      if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
        return { valido: false, error: 'El contenido del archivo no corresponde a una imagen PNG válida.' };
      }
    } else if (extLower === 'jpg' || extLower === 'jpeg') {
      if (buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
        return { valido: false, error: 'El contenido del archivo no corresponde a una imagen JPEG válida.' };
      }
    } else if (extLower === 'psd') {
      if (buffer[0] !== 0x38 || buffer[1] !== 0x42 || buffer[2] !== 0x50 || buffer[3] !== 0x53) {
        return { valido: false, error: 'El contenido no corresponde a un archivo PSD (Photoshop) válido.' };
      }
    } else if (extLower === 'zip') {
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
        return { valido: false, error: 'El contenido no corresponde a un archivo comprimido ZIP válido.' };
      }
    } else if (extLower === 'rar') {
      if (buffer[0] !== 0x52 || buffer[1] !== 0x41 || buffer[2] !== 0x52 || buffer[3] !== 0x21) {
        return { valido: false, error: 'El contenido no corresponde a un archivo RAR válido.' };
      }
    } else if (extLower === 'tiff') {
      const esTiffIntel = buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A;
      const esTiffMotorola = buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[3] === 0x2A;
      if (!esTiffIntel && !esTiffMotorola) {
        return { valido: false, error: 'El contenido no corresponde a una imagen TIFF válida.' };
      }
    } else if (extLower === 'svg') {
      const headerStr = buffer.slice(0, 1024).toString('utf8').toLowerCase();
      if (!headerStr.includes('<svg') && !headerStr.includes('<?xml')) {
        return { valido: false, error: 'El contenido no corresponde a un gráfico vectorial SVG válido.' };
      }
    } else if (extLower === 'ai') {
      const headerStr = buffer.slice(0, 1024).toString('latin1');
      if (!headerStr.includes('%PDF-') && !headerStr.includes('%!PS-Adobe') && (buffer[0] !== 0xD0 || buffer[1] !== 0xCF)) {
        return { valido: false, error: 'El contenido no corresponde a un archivo Adobe Illustrator (.ai) válido.' };
      }
    }

    return { valido: true };
  } catch (err) {
    return { valido: false, error: `Error al comprobar firma física del archivo: ${err.message}` };
  }
}

/**
 * Valida que una evidencia documental sea un archivo real, físicamente presente en el servidor,
 * con formato y tipo MIME admitidos, firma de contenido coherente, serialización atómica y separación de contextos.
 *
 * @param {import('express').Request} req - Petición Express
 * @param {string} campoArchivo - Nombre del campo de archivo
 * @param {string} campoTexto - Nombre del campo de texto de respaldo
 * @param {object} [orden] - Objeto orden contextual para verificar asociación
 * @param {object} [dbOrClient] - Cliente o pool de PostgreSQL para validar unicidad y bloqueo
 * @param {string} [contexto='general'] - 'aprobacion_diseno' | 'entrega_formal' | 'general'
 * @returns {Promise<{ valido: boolean, error?: string, codigoHttp?: number, filename?: string, ruta?: string, hashSha256?: string }>}
 */
async function validarArchivoEvidencia(
  req,
  campoArchivo = 'archivo',
  campoTexto = 'evidencia',
  orden = null,
  dbOrClient = null,
  contexto = 'general'
) {
  let nombreArchivo = null;
  let rutaFisica = null;
  let esCargaMultipart = false;

  // 1. Si vino a través de Multer (multipart/form-data)
  if (req.file) {
    esCargaMultipart = true;
    nombreArchivo = req.file.filename;
    rutaFisica = req.file.path || path.join(uploadDir, req.file.filename);

    const ext = path.extname(req.file.filename || req.file.originalname).toLowerCase().replace('.', '');
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      try { fs.unlinkSync(rutaFisica); } catch (_) {}
      return {
        valido: false,
        codigoHttp: 400,
        error: `Formato de archivo .${ext} no admitido. Formatos válidos: ${EXTENSIONES_PERMITIDAS.map((e) => e.toUpperCase()).join(', ')}.`,
      };
    }

    // Validación de tipo MIME
    const mimesPermitidos = MIME_PERMITIDOS_POR_EXT[ext] || [];
    const clientMime = String(req.file.mimetype || '').toLowerCase();
    if (clientMime && mimesPermitidos.length > 0 && !mimesPermitidos.includes(clientMime)) {
      try { fs.unlinkSync(rutaFisica); } catch (_) {}
      return {
        valido: false,
        codigoHttp: 400,
        error: `Tipo MIME "${clientMime}" incompatible con la extensión .${ext}. Archivo rechazado por seguridad.`,
      };
    }
  } else {
    // 2. Si vino en el cuerpo de la petición (JSON) referenciando un archivo cargado previamente
    const valorCampo = req.body ? (req.body[campoArchivo] || req.body[campoTexto] || req.body.soporte_evidencia) : null;

    if (valorCampo && typeof valorCampo === 'object') {
      nombreArchivo = valorCampo.nombre || valorCampo.filename || valorCampo.name;
    } else if (typeof valorCampo === 'string') {
      nombreArchivo = valorCampo.trim();
    }

    if (!nombreArchivo || !String(nombreArchivo).trim()) {
      return {
        valido: false,
        codigoHttp: 400,
        error: 'Debe adjuntar el archivo físico de soporte o evidencia documental mediante el mecanismo de carga.',
      };
    }

    // Sanitizar nombre para evitar path traversal
    const nombreLimpio = path.basename(String(nombreArchivo).trim());
    const ext = path.extname(nombreLimpio).toLowerCase().replace('.', '');

    if (!ext || !EXTENSIONES_PERMITIDAS.includes(ext)) {
      return {
        valido: false,
        codigoHttp: 400,
        error: `Formato de archivo .${ext || 'desconocido'} no admitido. Formatos válidos: ${EXTENSIONES_PERMITIDAS.map((e) => e.toUpperCase()).join(', ')}.`,
      };
    }

    rutaFisica = path.join(uploadDir, nombreLimpio);
    nombreArchivo = nombreLimpio;
  }

  // 3. Verificación de existencia física en disco
  if (!fs.existsSync(rutaFisica)) {
    return {
      valido: false,
      codigoHttp: 400,
      error: `El archivo de evidencia "${nombreArchivo}" no existe físicamente en el servidor. Debe cargar un archivo real antes de confirmar.`,
    };
  }

  // 4. Verificación de firma de contenido (magic numbers) para descartar ejecutables o extensiones falsas
  const extArchivo = path.extname(nombreArchivo).toLowerCase().replace('.', '');
  const testFirma = verificarFirmaContenido(rutaFisica, extArchivo);
  if (!testFirma.valido) {
    if (esCargaMultipart) {
      try { fs.unlinkSync(rutaFisica); } catch (_) {}
    }
    return {
      valido: false,
      codigoHttp: 400,
      error: testFirma.error,
    };
  }

  // 5. CÁLCULO DE HASH SHA-256 DEL CONTENIDO
  const hashSha256 = calcularHashSha256(rutaFisica);

  // 6. SERIALIZACIÓN ATÓMICA MEDIANTE ADVISORY LOCK DE POSTGRESQL (Prevención de condiciones de carrera)
  if (dbOrClient) {
    // Se utiliza el hash SHA-256 del contenido (o el nombre si el hash no estuviera disponible)
    const lockKey = hashSha256 || nombreArchivo;
    await dbOrClient.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
  }

  // 7. SEPARACIÓN ESTRICTA DE CONTEXTOS Y ASOCIACIÓN SEGURA CON LA ORDEN
  if (orden) {
    const ordenIdNum = orden.id || orden.dbId;
    const ordenCodigo = orden.codigo || (orden.id && String(orden.id).startsWith('OP-') ? orden.id : null);

    // 7.1 Validación de prefijo exclusivo
    const matchPrefijo = nombreArchivo.match(/^orden_([^_]+)_/i);
    if (matchPrefijo) {
      const prefijoExtraido = matchPrefijo[1];
      const coincideConEstaOrden =
        prefijoExtraido === String(ordenIdNum) ||
        (ordenCodigo && prefijoExtraido === String(ordenCodigo)) ||
        prefijoExtraido === 'general';

      if (!coincideConEstaOrden) {
        return {
          valido: false,
          codigoHttp: 400,
          error: `El archivo de evidencia "${nombreArchivo}" corresponde a otra orden (#${prefijoExtraido}) y no puede ser reutilizado en la orden actual.`,
        };
      }
    }

    // 7.2 Validación transaccional de contextos y no reutilización en PostgreSQL
    if (dbOrClient && ordenIdNum) {
      if (contexto === 'entrega_formal') {
        // REGLA 1: Una evidencia de entrega NO puede reutilizar archivos de soporte de diseño
        // (ni de otra orden NI de la misma orden)
        const arteDuplicadoRes = await dbOrClient.query(
          `SELECT a.orden_id, o.codigo AS orden_codigo
           FROM archivos_arte a
           LEFT JOIN ordenes o ON a.orden_id = o.id
           WHERE (a.soporte_evidencia = $1 OR a.ruta_archivo = $1 OR a.archivo_nombre = $1
                  OR (a.soporte_hash IS NOT NULL AND a.soporte_hash = $2))
           LIMIT 1`,
          [nombreArchivo, hashSha256 || '']
        );

        if (arteDuplicadoRes.rowCount > 0) {
          const art = arteDuplicadoRes.rows[0];
          const esMismaOrden = art.orden_id === ordenIdNum;
          return {
            valido: false,
            codigoHttp: 409,
            error: esMismaOrden
              ? `El archivo "${nombreArchivo}" ya está registrado como soporte de aprobación de diseño en esta misma orden. Una evidencia de entrega formal debe ser una remisión física independiente firmada por el receptor.`
              : `El archivo "${nombreArchivo}" ya está vinculado formalmente como soporte de diseño a la orden ${art.orden_codigo || '#' + art.orden_id}. No se permite la reutilización entre órdenes distintas.`,
          };
        }

        // REGLA 2: Una remisión de entrega no puede reutilizarse en otra orden distinta
        const entregaDuplicadaRes = await dbOrClient.query(
          `SELECT id, codigo FROM ordenes
           WHERE id != $1 AND (entrega_json->>'evidencia' = $2 OR (entrega_hash IS NOT NULL AND entrega_hash = $3))
           LIMIT 1`,
          [ordenIdNum, nombreArchivo, hashSha256 || '']
        );

        if (entregaDuplicadaRes.rowCount > 0) {
          const otraOrd = entregaDuplicadaRes.rows[0];
          return {
            valido: false,
            codigoHttp: 409,
            error: `El archivo "${nombreArchivo}" ya está registrado como remisión formal de entrega en la orden ${otraOrd.codigo || '#' + otraOrd.id}. Cada orden debe contar con su propia evidencia física de entrega.`,
          };
        }

      } else if (contexto === 'aprobacion_diseno') {
        // REGLA 3: Un soporte de diseño NO puede reutilizar una remisión de entrega (ni de otra orden ni de la misma orden)
        const entregaConflictoRes = await dbOrClient.query(
          `SELECT id, codigo FROM ordenes
           WHERE (entrega_json->>'evidencia' = $1 OR (entrega_hash IS NOT NULL AND entrega_hash = $2))
           LIMIT 1`,
          [nombreArchivo, hashSha256 || '']
        );

        if (entregaConflictoRes.rowCount > 0) {
          const ordConflicto = entregaConflictoRes.rows[0];
          const esMismaOrden = ordConflicto.id === ordenIdNum;
          return {
            valido: false,
            codigoHttp: 409,
            error: esMismaOrden
              ? `El archivo "${nombreArchivo}" ya está registrado como remisión de entrega en esta orden. Un visto bueno de diseño no puede reutilizar actas de entrega.`
              : `El archivo "${nombreArchivo}" ya está registrado como remisión formal de entrega en la orden ${ordConflicto.codigo || '#' + ordConflicto.id}. No se permite la reutilización entre órdenes distintas.`,
          };
        }

        // REGLA 4: Un soporte de diseño no puede reutilizarse en otra orden distinta
        const arteDuplicadoRes = await dbOrClient.query(
          `SELECT a.orden_id, o.codigo AS orden_codigo
           FROM archivos_arte a
           LEFT JOIN ordenes o ON a.orden_id = o.id
           WHERE (a.soporte_evidencia = $1 OR a.ruta_archivo = $1 OR a.archivo_nombre = $1
                  OR (a.soporte_hash IS NOT NULL AND a.soporte_hash = $2))
             AND a.orden_id != $3
           LIMIT 1`,
          [nombreArchivo, hashSha256 || '', ordenIdNum]
        );

        if (arteDuplicadoRes.rowCount > 0) {
          const otraOrd = arteDuplicadoRes.rows[0];
          return {
            valido: false,
            codigoHttp: 409,
            error: `El archivo "${nombreArchivo}" ya está vinculado formalmente a la orden ${otraOrd.orden_codigo || '#' + otraOrd.orden_id} como soporte de diseño. No se permite la reutilización entre órdenes distintas.`,
          };
        }

      } else {
        // Contexto general
        const arteDuplicadoRes = await dbOrClient.query(
          `SELECT a.orden_id, o.codigo AS orden_codigo
           FROM archivos_arte a
           LEFT JOIN ordenes o ON a.orden_id = o.id
           WHERE (a.soporte_evidencia = $1 OR a.ruta_archivo = $1 OR a.archivo_nombre = $1
                  OR (a.soporte_hash IS NOT NULL AND a.soporte_hash = $2))
             AND a.orden_id != $3
           LIMIT 1`,
          [nombreArchivo, hashSha256 || '', ordenIdNum]
        );

        if (arteDuplicadoRes.rowCount > 0) {
          const otraOrd = arteDuplicadoRes.rows[0];
          return {
            valido: false,
            codigoHttp: 409,
            error: `El archivo "${nombreArchivo}" ya está vinculado formalmente a la orden ${otraOrd.orden_codigo || '#' + otraOrd.orden_id} como soporte de diseño.`,
          };
        }

        const entregaDuplicadaRes = await dbOrClient.query(
          `SELECT id, codigo FROM ordenes
           WHERE id != $1 AND (entrega_json->>'evidencia' = $2 OR (entrega_hash IS NOT NULL AND entrega_hash = $3))
           LIMIT 1`,
          [ordenIdNum, nombreArchivo, hashSha256 || '']
        );

        if (entregaDuplicadaRes.rowCount > 0) {
          const otraOrd = entregaDuplicadaRes.rows[0];
          return {
            valido: false,
            codigoHttp: 409,
            error: `El archivo "${nombreArchivo}" ya está registrado como remisión formal de entrega en la orden ${otraOrd.codigo || '#' + otraOrd.id}.`,
          };
        }
      }
    }
  }

  return {
    valido: true,
    filename: nombreArchivo,
    originalname: req.file ? req.file.originalname : nombreArchivo,
    ruta: rutaFisica,
    hashSha256,
  };
}

module.exports = {
  uploadDir,
  EXTENSIONES_PERMITIDAS,
  MIME_PERMITIDOS_POR_EXT,
  calcularHashSha256,
  verificarFirmaContenido,
  validarArchivoEvidencia,
};
