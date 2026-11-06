// ============================================================
// controllers/clientesController.js — Controlador de Clientes
// ============================================================
const { pool } = require('../db');
const { resolverCliente, resolverUsuario, obtenerUsuarioPorDefecto } = require('../utils/resolvers');

function formatearCliente(c) {
  const municipio = c.municipio || c.ciudad || 'Medellín';
  return {
    id: c.codigo || c.id,
    uuid: c.id,
    codigo: c.codigo,
    nombre: c.empresa,
    empresa: c.empresa,
    tipoDocumento: c.tipo_documento || 'NIT',
    tipoCliente: c.tipo_cliente || 'Persona Jurídica (Empresa)',
    nit: c.nit,
    contacto: c.contacto_principal,
    contacto_principal: c.contacto_principal,
    telefono: c.telefono || '',
    correo: c.correo || '',
    direccion: c.direccion || 'Cra 15 # 80-20',
    pais: c.pais || 'Colombia',
    departamento: c.departamento || 'Antioquia',
    municipio,
    ciudad: c.ciudad || municipio,
    estado: c.estado,
    ejecutiva_id: c.ejecutiva_id,
    ejecutiva_nombre: c.ejecutiva_nombre || null,
    created_at: c.created_at,
  };
}

// Listar clientes con su ejecutiva asignada
const listarClientes = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.codigo,
        c.empresa,
        c.tipo_documento,
        c.tipo_cliente,
        c.nit,
        c.contacto_principal,
        c.telefono,
        c.correo,
        c.direccion,
        c.pais,
        c.departamento,
        c.municipio,
        c.ciudad,
        c.estado,
        c.created_at,
        c.ejecutiva_id,
        u.nombre_completo AS ejecutiva_nombre
      FROM clientes c
      INNER JOIN usuarios u ON c.ejecutiva_id = u.id
      ORDER BY NULLIF(regexp_replace(c.codigo, '[^0-9]', '', 'g'), '')::int ASC NULLS LAST, c.created_at ASC
    `);

    res.json({
      total: result.rowCount,
      data: result.rows.map(formatearCliente),
    });
  } catch (error) {
    console.error('clientesController.listarClientes error:', error.message);
    res.status(500).json({ error: 'Error al obtener clientes.' });
  }
};

// Obtener un cliente específico por ID o código
const obtenerClientePorId = async (req, res) => {
  try {
    const c = await resolverCliente(pool, req.params.id);
    if (!c) {
      return res.status(404).json({ error: `Cliente con ID ${req.params.id} no encontrado.` });
    }
    res.json({ data: formatearCliente(c) });
  } catch (error) {
    console.error('clientesController.obtenerClientePorId error:', error.message);
    res.status(500).json({ error: 'Error al obtener el cliente.' });
  }
};

// Crear cliente
const crearCliente = async (req, res) => {
  const empresa = req.body.empresa || req.body.nombre;
  const contacto_principal = req.body.contacto_principal || req.body.contacto;
  const tipo_documento = req.body.tipoDocumento || req.body.tipo_documento || 'NIT';
  const tipo_cliente = req.body.tipoCliente || req.body.tipo_cliente || 'Persona Jurídica (Empresa)';
  const nit = req.body.nit || `900${Date.now().toString().slice(-6)}-1`;
  const telefono = req.body.telefono || null;
  const correo = req.body.correo || null;
  const direccion = req.body.direccion || 'Cra 15 # 80-20';
  const pais = req.body.pais || 'Colombia';
  const departamento = req.body.departamento || 'Antioquia';
  const municipio = req.body.municipio || req.body.ciudad || 'Medellín';
  const ciudad = req.body.ciudad || municipio;
  const estado = req.body.estado || 'Nuevo';

  if (!empresa || !contacto_principal) {
    return res.status(400).json({
      error: 'Campos obligatorios: empresa/nombre y contacto_principal/contacto.',
    });
  }

  try {
    let ejec = null;
    if (req.body.ejecutiva_id) {
      ejec = await resolverUsuario(pool, req.body.ejecutiva_id);
    } else if (req.usuario?.rol === 'ejecutiva') {
      ejec = await resolverUsuario(pool, req.usuario.id);
    }
    if (!ejec) {
      ejec = await obtenerUsuarioPorDefecto(pool, 'ejecutiva');
    }

    const seqRes = await pool.query(`
      SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '[^0-9]', '', 'g'), '')::int), COUNT(*)::int) AS max_num
      FROM clientes
    `);
    const codigo = req.body.codigo || `C${(seqRes.rows[0]?.max_num || 0) + 1}`;

    const result = await pool.query(
      `INSERT INTO clientes (
        codigo, empresa, tipo_documento, tipo_cliente, nit,
        contacto_principal, telefono, correo, direccion,
        pais, departamento, municipio, ciudad, ejecutiva_id, estado
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        codigo,
        empresa.trim(),
        tipo_documento,
        tipo_cliente,
        nit.trim(),
        contacto_principal.trim(),
        telefono ? telefono.trim() : null,
        correo ? correo.trim().toLowerCase() : null,
        direccion.trim(),
        pais.trim(),
        departamento.trim(),
        municipio.trim(),
        ciudad.trim(),
        ejec.id,
        estado,
      ]
    );

    res.status(201).json({
      message: 'Cliente creado exitosamente.',
      data: formatearCliente({
        ...result.rows[0],
        ejecutiva_nombre: ejec.nombre_completo,
      }),
    });
  } catch (error) {
    console.error('clientesController.crearCliente error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un cliente registrado con este NIT o código.' });
    }
    res.status(500).json({ error: 'Error al registrar cliente.' });
  }
};

// Actualizar cliente
const actualizarCliente = async (req, res) => {
  try {
    const actual = await resolverCliente(pool, req.params.id);
    if (!actual) {
      return res.status(404).json({ error: `Cliente ${req.params.id} no encontrado.` });
    }

    const empresa = (req.body.empresa || req.body.nombre || actual.empresa).trim();
    const contacto = (req.body.contacto_principal || req.body.contacto || actual.contacto_principal).trim();
    const tipo_documento = req.body.tipoDocumento || req.body.tipo_documento || actual.tipo_documento || 'NIT';
    const tipo_cliente = req.body.tipoCliente || req.body.tipo_cliente || actual.tipo_cliente || 'Persona Jurídica (Empresa)';
    const telefono = req.body.telefono !== undefined ? req.body.telefono : actual.telefono;
    const correo = req.body.correo !== undefined ? req.body.correo : actual.correo;
    const direccion = req.body.direccion !== undefined ? req.body.direccion : actual.direccion;
    const pais = req.body.pais || actual.pais || 'Colombia';
    const departamento = req.body.departamento || actual.departamento || 'Antioquia';
    const municipio = req.body.municipio || req.body.ciudad || actual.municipio || actual.ciudad || 'Medellín';
    const ciudad = req.body.ciudad || municipio;
    const estado = req.body.estado || actual.estado;

    const result = await pool.query(
      `UPDATE clientes
       SET empresa = $1, contacto_principal = $2, telefono = $3, correo = $4, direccion = $5,
           ciudad = $6, estado = $7, tipo_documento = $8, tipo_cliente = $9,
           pais = $10, departamento = $11, municipio = $12
       WHERE id = $13
       RETURNING *`,
      [empresa, contacto, telefono, correo, direccion, ciudad, estado, tipo_documento, tipo_cliente, pais, departamento, municipio, actual.id]
    );

    res.json({
      message: 'Cliente actualizado exitosamente.',
      data: formatearCliente(result.rows[0]),
    });
  } catch (error) {
    console.error('clientesController.actualizarCliente error:', error.message);
    res.status(500).json({ error: 'Error al actualizar cliente.' });
  }
};

module.exports = {
  listarClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
};
