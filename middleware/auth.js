// ============================================================
// middleware/auth.js — Verificación de Tokens JWT y Roles
// ============================================================
const jwt = require('jsonwebtoken');

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
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'huellas_default_secret');
    req.usuario = payload;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'El token ha expirado. Por favor inicia sesión nuevamente.' });
    }
    return res.status(401).json({ error: 'Token inválido o corrupto.' });
  }
}

/**
 * Middleware para restringir acceso según los roles permitidos
 * @param  {...string} rolesPermitidos - Ej: 'gerente', 'coord', 'ejecutiva'
 */
function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}. Tu rol actual es: ${req.usuario.rol}`,
      });
    }

    next();
  };
}

module.exports = {
  verificarToken,
  verificarRol,
};
