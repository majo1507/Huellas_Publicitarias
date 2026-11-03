// ============================================================
// utils/resolvers.js — Resolución de códigos ORVEX y mapeos
// Permite que los endpoints acepten tanto IDs nativos (UUID / INT)
// como códigos legibles del frontend (OP-2026-0001, U1, C1, SOL-..., T-..., PV-..., COM-...)
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

function formatearFechaHoy(fecha = new Date()) {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const yyyy = fecha.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatearHoraAhora(fecha = new Date()) {
  const hh = String(fecha.getHours()).padStart(2, '0');
  const mi = String(fecha.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

// Mapeo de roles entre base de datos y frontend
const ROL_DB_TO_UI = {
  ejecutiva: { roleKey: 'comercial', label: 'Comercial', cargoDefault: 'Ejecutiva comercial' },
  coord: { roleKey: 'coordinador', label: 'Coordinador', cargoDefault: 'Coordinador de producción' },
  disenador: { roleKey: 'disenador', label: 'Diseñador', cargoDefault: 'Diseñadora gráfica' },
  produccion: { roleKey: 'operario', label: 'Operario', cargoDefault: 'Operario de taller' },
  postventa: { roleKey: 'postventa', label: 'Postventa', cargoDefault: 'Atención postventa' },
  gerente: { roleKey: 'gerencia', label: 'Gerencia', cargoDefault: 'Gerente general' },
};

const ROL_INPUT_TO_DB = {
  ejecutiva: 'ejecutiva',
  comercial: 'ejecutiva',
  'comercial / recepción': 'ejecutiva',
  coord: 'coord',
  coordinador: 'coord',
  'coordinador de producción': 'coord',
  disenador: 'disenador',
  diseñador: 'disenador',
  'diseñador gráfico': 'disenador',
  produccion: 'produccion',
  producción: 'produccion',
  operario: 'produccion',
  'operario de taller': 'produccion',
  postventa: 'postventa',
  'atención postventa': 'postventa',
  gerente: 'gerente',
  gerencia: 'gerente',
  'gerencia general': 'gerente',
};

function normalizarRolDb(rolInput) {
  if (!rolInput) return null;
  return ROL_INPUT_TO_DB[String(rolInput).trim().toLowerCase()] || null;
}

const ETAPA_NUM_TO_NOMBRE_UI = {
  0: 'Solicitud',
  1: 'Diseño',
  2: 'Aprobación',
  3: 'Aprobación',
  4: 'Impresión',
  5: 'Acabados',
  6: 'Acabados',
  7: 'Despacho',
  8: 'Entrega',
};

const ESTADO_UI_TO_ETAPA_NUM = {
  Solicitud: 0,
  Diseño: 1,
  Aprobación: 2,
  Impresión: 4,
  Acabados: 5,
  Despacho: 7,
  Entrega: 8,
  Postventa: 8,
  Cerrada: 8,
};

async function resolverOrden(dbOrClient, idOrCodigo, forUpdate = false) {
  if (idOrCodigo === undefined || idOrCodigo === null) return null;
  const str = String(idOrCodigo).trim();
  const lock = forUpdate ? ' FOR UPDATE' : '';

  if (/^\d+$/.test(str)) {
    const res = await dbOrClient.query(`SELECT * FROM ordenes WHERE id = $1${lock}`, [parseInt(str, 10)]);
    if (res.rowCount > 0) return res.rows[0];
  }

  const res = await dbOrClient.query(`SELECT * FROM ordenes WHERE codigo = $1${lock}`, [str]);
  return res.rowCount > 0 ? res.rows[0] : null;
}

async function resolverCliente(dbOrClient, idOrCodigo) {
  if (!idOrCodigo) return null;
  const str = String(idOrCodigo).trim();
  if (esUuid(str)) {
    const res = await dbOrClient.query('SELECT * FROM clientes WHERE id = $1', [str]);
    if (res.rowCount > 0) return res.rows[0];
  }
  const res = await dbOrClient.query('SELECT * FROM clientes WHERE codigo = $1 OR LOWER(empresa) = LOWER($1)', [str]);
  return res.rowCount > 0 ? res.rows[0] : null;
}

async function resolverUsuario(dbOrClient, idOrCodigoOrNombre) {
  if (!idOrCodigoOrNombre) return null;
  const str = String(idOrCodigoOrNombre).trim();
  if (esUuid(str)) {
    const res = await dbOrClient.query('SELECT * FROM usuarios WHERE id = $1', [str]);
    if (res.rowCount > 0) return res.rows[0];
  }
  const res = await dbOrClient.query(
    'SELECT * FROM usuarios WHERE codigo = $1 OR LOWER(email) = LOWER($1) OR LOWER(nombre_completo) = LOWER($1) LIMIT 1',
    [str]
  );
  return res.rowCount > 0 ? res.rows[0] : null;
}

async function obtenerUsuarioPorDefecto(dbOrClient, rolDb = 'ejecutiva') {
  const res = await dbOrClient.query(
    'SELECT * FROM usuarios WHERE rol = $1 AND esta_activo = true ORDER BY created_at ASC LIMIT 1',
    [rolDb]
  );
  if (res.rowCount > 0) return res.rows[0];
  const anyRes = await dbOrClient.query('SELECT * FROM usuarios ORDER BY created_at ASC LIMIT 1');
  return anyRes.rows[0] || null;
}

module.exports = {
  esUuid,
  formatearFechaHoy,
  formatearHoraAhora,
  ROL_DB_TO_UI,
  normalizarRolDb,
  ETAPA_NUM_TO_NOMBRE_UI,
  ESTADO_UI_TO_ETAPA_NUM,
  resolverOrden,
  resolverCliente,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
};
