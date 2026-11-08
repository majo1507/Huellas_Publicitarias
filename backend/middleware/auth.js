// ============================================================
// middleware/auth.js — Verificación de Tokens JWT, Roles Normalizados y Delegaciones
// ============================================================
const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'orvex_huellas_jwt_secret_2026_enterprise_secure_key';
}

const MAPA_ROLES_CANONICOS = {
  // Alias de UI (Frontend) -> Rol Canónico Backend / PostgreSQL
  comercial: 'ejecutiva',
  coordinador: 'coord',
  operario: 'produccion',
  gerencia: 'gerente',
  disenador: 'disenador',
  postventa: 'postventa',
  cliente: 'cliente',
  // Canónicos de Backend / PostgreSQL -> Auto-mapeo
  ejecutiva: 'ejecutiva',
  coord: 'coord',
  produccion: 'produccion',
  gerente: 'gerente',
};

/**
 * Normaliza cualquier variante de nombre de rol a su forma canónica de base de datos
 * @param {string} rol
 * @returns {string}
 */
function normalizarRol(rol) {
  if (!rol) return '';
  const r = String(rol).trim().toLowerCase();
  return MAPA_ROLES_CANONICOS[r] || r;
}

/**
 * Middleware para validar que la petición incluye un token Bearer válido
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Acceso no autorizado. Se requiere un token Bearer válido en la cabecera Authorization.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.usuario = payload;
    req.usuario.rol_normalizado = normalizarRol(payload.rol);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'El token ha expirado. Por favor inicia sesión nuevamente.' });
    }
    return res.status(401).json({ error: 'Token inválido o corrupto.' });
  }
}

/**
 * Middleware para restringir acceso según los roles permitidos y delegaciones activas
 * @param  {...string} rolesPermitidos - Ej: 'coord', 'gerente', 'ejecutiva', etc.
 */
function verificarRol(...rolesPermitidos) {
  const rolesCanonicos = rolesPermitidos.map(normalizarRol);

  return async (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    const rolUsuario = normalizarRol(req.usuario.rol);
    req.usuario.rol_normalizado = rolUsuario;

    // 1. Autorización directa por rol canónico
    if (rolesCanonicos.includes(rolUsuario)) {
      return next();
    }

    // 2. Comprobar si existe una delegación temporal activa para este endpoint/capacidad
    const capacidad = req.capacidadRequerida;
    if (capacidad && req.usuario.id) {
      try {
        const { pool } = require('../db');
        const delRes = await pool.query(
          `SELECT * FROM delegaciones_permisos
           WHERE usuario_suplente_id = $1
             AND activo = true
             AND CURRENT_TIMESTAMP BETWEEN fecha_inicio AND fecha_fin
             AND permisos_delegados ? $2
           LIMIT 1`,
          [req.usuario.id, capacidad]
        );

        if (delRes.rowCount > 0) {
          req.usuario.delegacion_activa = delRes.rows[0];
          return next();
        }
      } catch (err) {
        console.error('Error al verificar delegación temporal:', err.message);
      }
    }

    return res.status(403).json({
      error: `Acceso denegado. Tu rol actual (${req.usuario.rol}) no tiene permisos para ejecutar esta operación.`,
      roles_requeridos: rolesPermitidos,
    });
  };
}

/**
 * Middleware auxiliar para asociar una capacidad específica a la verificación de rol/delegación
 * @param {string} capacidad - Ej: 'ordenes.clonar', 'solicitudes.validar'
 */
function asociarCapacidad(capacidad) {
  return (req, res, next) => {
    req.capacidadRequerida = capacidad;
    next();
  };
}

module.exports = {
  getJwtSecret,
  normalizarRol,
  MAPA_ROLES_CANONICOS,
  verificarToken,
  verificarRol,
  asociarCapacidad,
};
