// ============================================================
// controllers/inventarioController.js — Inventario, Proveedores y Movimientos
// ============================================================
const { pool } = require('../db');
const {
  resolverOrden,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
  formatearFechaHoy,
  formatearHoraAhora,
} = require('../utils/resolvers');

function formatearMaterialRow(r) {
  return {
    id: r.codigo || `MAT-${String(r.id).padStart(3, '0')}`,
    dbId: r.id,
    codigo: r.codigo || `MAT-${String(r.id).padStart(3, '0')}`,
    nombre: r.nombre_material,
    descripcion: r.descripcion || '',
    categoria: r.categoria || 'Insumos de impresión',
    unidad: r.unidad || 'Unidades',
    stockActual: Number(r.stock_actual || 0),
    cantidadUtilizada: Number(r.cantidad_utilizada || 0),
    stockMinimo: Number(r.stock_minimo || 0),
    costoUnitario: Number(r.costo_unitario || 0),
    proveedorId: r.proveedor_codigo || '',
    proveedor: r.proveedor_nombre || 'Por definir',
    fechaActualizacion: r.fecha_actualizacion || formatearFechaHoy(r.updated_at ? new Date(r.updated_at) : new Date()),
  };
}

function formatearProveedorRow(r) {
  let productos = [];
  if (Array.isArray(r.productos)) {
    productos = r.productos;
  } else if (typeof r.productos === 'string' && r.productos.trim()) {
    try {
      productos = JSON.parse(r.productos);
    } catch {
      productos = r.productos.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return {
    id: r.codigo || `PRV-${String(r.id).padStart(2, '0')}`,
    dbId: r.id,
    nombre: r.nombre,
    nit: r.nit || '',
    contacto: r.contacto || '',
    telefono: r.telefono || '',
    correo: r.correo || '',
    ciudad: r.ciudad || 'Bogotá',
    productos,
    estado: r.estado || 'Activo',
  };
}

function formatearMovimientoRow(r) {
  const dt = r.created_at ? new Date(r.created_at) : new Date();
  const tipoCapitalizado = r.tipo === 'salida' ? 'Salida' : 'Entrada';
  return {
    id: r.codigo || `MOV-${String(r.id).slice(0, 6).toUpperCase()}`,
    fecha: r.fecha_texto || formatearFechaHoy(dt),
    hora: r.hora_texto || formatearHoraAhora(dt),
    tipo: tipoCapitalizado,
    materialId: r.material_codigo || `MAT-${String(r.material_id).padStart(3, '0')}`,
    material: r.nombre_material || 'Material',
    cantidad: Number(r.cantidad || 0),
    unidad: r.unidad || 'Unidades',
    costoTotal: Number(r.costo_total || 0),
    ordenId: r.orden_codigo || (r.orden_id ? `OP-2026-${String(r.orden_id).padStart(4, '0')}` : null),
    responsable: r.responsable_nombre || 'Coordinador',
    observacion: r.observacion || '',
  };
}

const listarInventario = async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventario ORDER BY id ASC');
    res.json({
      total: result.rowCount,
      data: result.rows.map(formatearMaterialRow),
    });
  } catch (error) {
    console.error('inventarioController.listarInventario error:', error.message);
    res.status(500).json({ error: 'Error al consultar el inventario.' });
  }
};

const crearMaterial = async (req, res) => {
  const {
    id,
    codigo,
    nombre,
    descripcion,
    categoria,
    unidad,
    stockActual,
    cantidadUtilizada,
    stockMinimo,
    costoUnitario,
    proveedorId,
    proveedor,
  } = req.body || {};

  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ error: 'El nombre del material es obligatorio.' });
  }

  try {
    const cod = codigo || id || `MAT-${String(Date.now()).slice(-3)}`;
    const ins = await pool.query(
      `INSERT INTO inventario (
        codigo, nombre_material, descripcion, categoria, unidad,
        stock_actual, cantidad_utilizada, stock_minimo, costo_unitario,
        proveedor_codigo, proveedor_nombre, fecha_actualizacion
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        cod,
        String(nombre).trim(),
        descripcion || '',
        categoria || 'Insumos de impresión',
        unidad || 'Unidades',
        Number(stockActual || 0),
        Number(cantidadUtilizada || 0),
        Number(stockMinimo || 0),
        Number(costoUnitario || 0),
        proveedorId || '',
        proveedor || 'Por definir',
        formatearFechaHoy(),
      ]
    );

    res.status(201).json({
      message: 'Material registrado en el inventario exitosamente.',
      data: formatearMaterialRow(ins.rows[0]),
    });
  } catch (error) {
    console.error('inventarioController.crearMaterial error:', error.message);
    res.status(500).json({ error: 'Error al registrar el material en el inventario.' });
  }
};

const listarProveedores = async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores ORDER BY id ASC');
    res.json({
      total: result.rowCount,
      data: result.rows.map(formatearProveedorRow),
    });
  } catch (error) {
    console.error('inventarioController.listarProveedores error:', error.message);
    res.status(500).json({ error: 'Error al consultar proveedores.' });
  }
};

const crearProveedor = async (req, res) => {
  const { id, codigo, nombre, nit, contacto, telefono, correo, ciudad, productos, estado } = req.body || {};

  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
  }

  try {
    const cod = codigo || id || `PRV-${String(Date.now()).slice(-2)}`;
    const prodArray = Array.isArray(productos)
      ? productos
      : String(productos || '').split(',').map((s) => s.trim()).filter(Boolean);

    const ins = await pool.query(
      `INSERT INTO proveedores (
        codigo, nombre, nit, contacto, telefono, correo, ciudad, productos, estado
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      RETURNING *`,
      [
        cod,
        String(nombre).trim(),
        nit || '',
        contacto || '',
        telefono || '',
        correo || '',
        ciudad || 'Bogotá',
        JSON.stringify(prodArray),
        estado || 'Activo',
      ]
    );

    res.status(201).json({
      message: 'Proveedor registrado exitosamente.',
      data: formatearProveedorRow(ins.rows[0]),
    });
  } catch (error) {
    console.error('inventarioController.crearProveedor error:', error.message);
    res.status(500).json({ error: 'Error al registrar el proveedor.' });
  }
};

const listarMovimientos = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        m.*,
        i.codigo AS material_codigo,
        i.nombre_material,
        i.unidad,
        o.codigo AS orden_codigo,
        COALESCE(m.responsable_nombre, u.nombre_completo) AS responsable_nombre
       FROM movimientos_inventario m
       INNER JOIN inventario i ON m.material_id = i.id
       LEFT JOIN ordenes o ON m.orden_id = o.id
       LEFT JOIN usuarios u ON m.usuario_responsable_id = u.id
       ORDER BY m.created_at DESC`
    );

    res.json({
      total: result.rowCount,
      data: result.rows.map(formatearMovimientoRow),
    });
  } catch (error) {
    console.error('inventarioController.listarMovimientos error:', error.message);
    res.status(500).json({ error: 'Error al consultar movimientos de inventario.' });
  }
};

const registrarMovimiento = async (req, res) => {
  const { id, tipo, materialId, cantidad, ordenId, responsable, observacion } = req.body || {};

  const cantNum = Number(cantidad || 0);
  if (!materialId || cantNum <= 0) {
    return res.status(400).json({ error: 'Debes indicar un material válido y una cantidad mayor a cero.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const matRes = await client.query(
      'SELECT * FROM inventario WHERE codigo = $1 OR id::text = $1 FOR UPDATE',
      [String(materialId)]
    );
    if (matRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Material ${materialId} no encontrado.` });
    }
    const mat = matRes.rows[0];
    const tipoDb = String(tipo || 'Entrada').toLowerCase() === 'salida' ? 'salida' : 'entrada';

    if (tipoDb === 'salida' && Number(mat.stock_actual) < cantNum) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Stock insuficiente para ${mat.nombre_material}. Disponible: ${mat.stock_actual}.`,
      });
    }

    const nuevoStock = tipoDb === 'salida' ? Number(mat.stock_actual) - cantNum : Number(mat.stock_actual) + cantNum;
    const nuevaUtilizada = tipoDb === 'salida' ? Number(mat.cantidad_utilizada || 0) + cantNum : Number(mat.cantidad_utilizada || 0);

    await client.query(
      'UPDATE inventario SET stock_actual = $1, cantidad_utilizada = $2, fecha_actualizacion = $3 WHERE id = $4',
      [nuevoStock, nuevaUtilizada, formatearFechaHoy(), mat.id]
    );

    const ord = ordenId ? await resolverOrden(client, ordenId) : null;
    const usr = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'coord'));

    const costoTotal = Math.round(cantNum * Number(mat.costo_unitario || 0));
    const insMov = await client.query(
      `INSERT INTO movimientos_inventario (
        codigo, material_id, orden_id, usuario_responsable_id, cantidad, tipo,
        fecha_texto, hora_texto, costo_total, responsable_nombre, observacion
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        id || `MOV-${String(Date.now()).slice(-4)}`,
        mat.id,
        ord ? ord.id : null,
        usr.id,
        cantNum,
        tipoDb,
        formatearFechaHoy(),
        formatearHoraAhora(),
        costoTotal,
        responsable || req.usuario?.nombre_completo || usr.nombre_completo,
        observacion || '',
      ]
    );

    await client.query('COMMIT');

    const row = insMov.rows[0];
    res.status(201).json({
      message: 'Movimiento de inventario registrado exitosamente.',
      data: formatearMovimientoRow({
        ...row,
        material_codigo: mat.codigo,
        nombre_material: mat.nombre_material,
        unidad: mat.unidad,
        orden_codigo: ord ? ord.codigo : null,
      }),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('inventarioController.registrarMovimiento error:', error.message);
    res.status(500).json({ error: 'Error al registrar movimiento de inventario.' });
  } finally {
    client.release();
  }
};

module.exports = {
  listarInventario,
  crearMaterial,
  listarProveedores,
  crearProveedor,
  listarMovimientos,
  registrarMovimiento,
};
