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
    stockReservado: Number(r.stock_reservado || 0),
    disponibleReal: Math.max(0, Number(r.stock_actual || 0) - Number(r.stock_reservado || 0)),
    cantidadUtilizada: Number(r.cantidad_utilizada || 0),
    stockMinimo: Number(r.stock_minimo || 0),
    costoUnitario: Number(r.costo_unitario || 0),
    proveedorId: r.proveedor_codigo || '',
    proveedor: r.proveedor_nombre || 'Por definir',
    archivado: !!r.archivado,
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
    archivado: !!r.archivado,
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

const listarInventario = async (req, res) => {
  try {
    const incluirArchivados = req.query.incluir_archivados === 'true' || req.query.archivados === 'true';
    const whereClause = incluirArchivados ? '' : 'WHERE COALESCE(archivado, false) = false';
    const result = await pool.query(`SELECT * FROM inventario ${whereClause} ORDER BY id ASC`);
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

const listarProveedores = async (req, res) => {
  try {
    const incluirArchivados = req.query.incluir_archivados === 'true' || req.query.archivados === 'true';
    const whereClause = incluirArchivados ? '' : 'WHERE COALESCE(archivado, false) = false';
    const result = await pool.query(`SELECT * FROM proveedores ${whereClause} ORDER BY id ASC`);
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

// Reservar materiales para una orden formal con control de disponibilidad y déficit
const reservarMateriales = async (req, res) => {
  const { orden_id, material_id, cantidad_requerida } = req.body;
  const cantReq = parseFloat(cantidad_requerida);

  if (!orden_id || !material_id || isNaN(cantReq) || cantReq <= 0) {
    return res.status(400).json({
      error: 'Campos obligatorios: orden_id, material_id y cantidad_requerida (número positivo).',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, orden_id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${orden_id} no encontrada.` });
    }

    const matRes = await client.query(
      'SELECT id, nombre_material, stock_actual, stock_reservado, stock_minimo FROM inventario WHERE id = $1 FOR UPDATE',
      [material_id]
    );
    if (matRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Material de inventario #${material_id} no encontrado.` });
    }

    const mat = matRes.rows[0];
    const stockActual = parseFloat(mat.stock_actual);
    const stockReservado = parseFloat(mat.stock_reservado || 0);
    const disponibleReal = Math.max(0, stockActual - stockReservado);

    let reservable = 0;
    let deficit = 0;

    if (disponibleReal >= cantReq) {
      reservable = cantReq;
      deficit = 0;
    } else {
      reservable = disponibleReal;
      deficit = parseFloat((cantReq - disponibleReal).toFixed(2));
    }

    let reservaRow = null;
    if (reservable > 0) {
      await client.query(
        'UPDATE inventario SET stock_reservado = stock_reservado + $1 WHERE id = $2',
        [reservable, mat.id]
      );

      const insRes = await client.query(
        `INSERT INTO orden_material_reserva (orden_id, material_id, cantidad_reservada, estado)
         VALUES ($1, $2, $3, 'activa')
         RETURNING *`,
        [orden.id, mat.id, reservable]
      );
      reservaRow = insRes.rows[0];
    }

    let deficitRow = null;
    if (deficit > 0) {
      const insDef = await client.query(
        `INSERT INTO orden_material_deficit (orden_id, material_id, cantidad_requerida, cantidad_disponible, deficit_pendiente, resuelto)
         VALUES ($1, $2, $3, $4, $5, false)
         RETURNING *`,
        [orden.id, mat.id, cantReq, reservable, deficit]
      );
      deficitRow = insDef.rows[0];
    }

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'coord'));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    let auditText = `Reserva de material para orden ${orden.codigo || orden.id}: ${reservable} uds de "${mat.nombre_material}".`;
    if (deficit > 0) {
      auditText += ` Se registró déficit pendiente de abastecimiento de ${deficit} uds.`;
    }

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',true)`,
      [orden.id, respUser.id, auditText, formatearFechaHoy(), formatearHoraAhora(), respNombre]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: deficit > 0
        ? `Reserva parcial: ${reservable} uds reservadas. Déficit pendiente: ${deficit} uds de "${mat.nombre_material}".`
        : `Reserva exitosa de ${reservable} uds de "${mat.nombre_material}".`,
      reserva: reservaRow,
      deficit: deficitRow,
      disponible_restante: Math.max(0, disponibleReal - reservable),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('inventarioController.reservarMateriales error:', error.message);
    res.status(500).json({ error: 'Error al reservar materiales.' });
  } finally {
    client.release();
  }
};

// Liberar reservas de una orden (por cancelación o reevaluación)
const liberarReservas = async (req, res) => {
  const ordenId = req.params.orden_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, ordenId, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${ordenId} no encontrada.` });
    }

    const resActivas = await client.query(
      `SELECT r.*, m.nombre_material
       FROM orden_material_reserva r
       INNER JOIN inventario m ON r.material_id = m.id
       WHERE r.orden_id = $1 AND r.estado = 'activa'
       FOR UPDATE`,
      [orden.id]
    );

    if (resActivas.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.json({ message: 'No hay reservas activas que liberar para esta orden.', liberadas: 0 });
    }

    for (const r of resActivas.rows) {
      await client.query(
        'UPDATE inventario SET stock_reservado = GREATEST(0, stock_reservado - $1) WHERE id = $2',
        [r.cantidad_reservada, r.material_id]
      );
      await client.query(
        "UPDATE orden_material_reserva SET estado = 'liberada', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [r.id]
      );
    }

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'coord'));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',true)`,
      [
        orden.id,
        respUser.id,
        `Liberación de ${resActivas.rowCount} reserva(s) de insumos de la orden.`,
        formatearFechaHoy(),
        formatearHoraAhora(),
        respNombre,
      ]
    );

    await client.query('COMMIT');

    res.json({
      message: `Se liberaron exitosamente ${resActivas.rowCount} reserva(s) de insumos de la orden ${orden.codigo || orden.id}.`,
      liberadas: resActivas.rowCount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('inventarioController.liberarReservas error:', error.message);
    res.status(500).json({ error: 'Error al liberar reservas de inventario.' });
  } finally {
    client.release();
  }
};

// Actualizar material
const actualizarMaterial = async (req, res) => {
  try {
    const matId = req.params.id;
    const findRes = await pool.query(
      'SELECT * FROM inventario WHERE id::text = $1 OR codigo = $1 LIMIT 1',
      [String(matId).trim()]
    );
    if (findRes.rows.length === 0) {
      return res.status(404).json({ error: `Material ${matId} no encontrado.` });
    }
    const actual = findRes.rows[0];

    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim() : actual.nombre_material;
    const descripcion = req.body.descripcion !== undefined ? req.body.descripcion.trim() : actual.descripcion;
    const categoria = req.body.categoria !== undefined ? req.body.categoria.trim() : actual.categoria;
    const unidad = req.body.unidad !== undefined ? req.body.unidad.trim() : actual.unidad;
    const stockMinimo = req.body.stockMinimo !== undefined ? Number(req.body.stockMinimo) : actual.stock_minimo;
    const costoUnitario = req.body.costoUnitario !== undefined ? Number(req.body.costoUnitario) : actual.costo_unitario;

    const upRes = await pool.query(
      `UPDATE inventario
       SET nombre_material = $1, descripcion = $2, categoria = $3, unidad = $4,
           stock_minimo = $5, costo_unitario = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [nombre, descripcion, categoria, unidad, stockMinimo, costoUnitario, actual.id]
    );

    res.json({
      message: 'Material actualizado exitosamente.',
      data: formatearMaterialRow(upRes.rows[0]),
    });
  } catch (error) {
    console.error('inventarioController.actualizarMaterial error:', error.message);
    res.status(500).json({ error: 'Error al actualizar material.' });
  }
};

// Archivar material
const archivarMaterial = async (req, res) => {
  try {
    const matId = req.params.id;
    const upRes = await pool.query(
      'UPDATE inventario SET archivado = true, updated_at = NOW() WHERE id::text = $1 OR codigo = $1 RETURNING *',
      [String(matId).trim()]
    );
    if (upRes.rows.length === 0) {
      return res.status(404).json({ error: `Material ${matId} no encontrado.` });
    }
    res.json({
      message: 'Material archivado exitosamente.',
      data: formatearMaterialRow(upRes.rows[0]),
    });
  } catch (error) {
    console.error('inventarioController.archivarMaterial error:', error.message);
    res.status(500).json({ error: 'Error al archivar material.' });
  }
};

// Restaurar material
const restaurarMaterial = async (req, res) => {
  try {
    const matId = req.params.id;
    const upRes = await pool.query(
      'UPDATE inventario SET archivado = false, updated_at = NOW() WHERE id::text = $1 OR codigo = $1 RETURNING *',
      [String(matId).trim()]
    );
    if (upRes.rows.length === 0) {
      return res.status(404).json({ error: `Material ${matId} no encontrado.` });
    }
    res.json({
      message: 'Material restaurado exitosamente.',
      data: formatearMaterialRow(upRes.rows[0]),
    });
  } catch (error) {
    console.error('inventarioController.restaurarMaterial error:', error.message);
    res.status(500).json({ error: 'Error al restaurar material.' });
  }
};

// Eliminar material seguro (verifica stock y movimientos contables)
const eliminarMaterial = async (req, res) => {
  try {
    const matId = req.params.id;
    const findRes = await pool.query(
      'SELECT * FROM inventario WHERE id::text = $1 OR codigo = $1 LIMIT 1',
      [String(matId).trim()]
    );
    if (findRes.rows.length === 0) {
      return res.status(404).json({ error: `Material ${matId} no encontrado.` });
    }
    const mat = findRes.rows[0];

    // Verificar si tiene stock actual > 0
    if (Number(mat.stock_actual || 0) > 0) {
      return res.status(400).json({
        error: `No es posible eliminar el material "${mat.nombre_material}" porque cuenta con un saldo de stock físico actual de ${mat.stock_actual} ${mat.unidad}. Archívelo para mantener la consistencia del inventario.`,
      });
    }

    // Verificar si tiene movimientos registrados
    const movsCheck = await pool.query(
      'SELECT COUNT(*)::int AS total FROM movimientos_inventario WHERE material_id = $1',
      [mat.id]
    );
    if (movsCheck.rows[0].total > 0) {
      return res.status(400).json({
        error: `No es posible eliminar el material "${mat.nombre_material}" porque tiene ${movsCheck.rows[0].total} movimientos contables registrados en el historial de almacén. Utilice la opción de archivar.`,
      });
    }

    // Verificar si tiene reservas activas
    const resCheck = await pool.query(
      'SELECT COUNT(*)::int AS total FROM reservas_materiales WHERE material_id = $1',
      [mat.id]
    );
    if (resCheck.rows[0].total > 0) {
      return res.status(400).json({
        error: `No es posible eliminar el material "${mat.nombre_material}" porque tiene reservas vinculadas a órdenes de producción.`,
      });
    }

    await pool.query('DELETE FROM inventario WHERE id = $1', [mat.id]);
    res.json({
      message: `Material "${mat.nombre_material}" eliminado permanentemente.`,
      id: mat.codigo || mat.id,
    });
  } catch (error) {
    console.error('inventarioController.eliminarMaterial error:', error.message);
    res.status(500).json({ error: 'Error al eliminar material.' });
  }
};

// Actualizar proveedor
const actualizarProveedor = async (req, res) => {
  try {
    const prvId = req.params.id;
    const findRes = await pool.query(
      'SELECT * FROM proveedores WHERE id::text = $1 OR codigo = $1 LIMIT 1',
      [String(prvId).trim()]
    );
    if (findRes.rows.length === 0) {
      return res.status(404).json({ error: `Proveedor ${prvId} no encontrado.` });
    }
    const actual = findRes.rows[0];

    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim() : actual.nombre;
    const nit = req.body.nit !== undefined ? req.body.nit.trim() : actual.nit;
    const contacto = req.body.contacto !== undefined ? req.body.contacto.trim() : actual.contacto;
    const telefono = req.body.telefono !== undefined ? req.body.telefono.trim() : actual.telefono;
    const correo = req.body.correo !== undefined ? req.body.correo.trim() : actual.correo;
    const ciudad = req.body.ciudad !== undefined ? req.body.ciudad.trim() : actual.ciudad;
    const estado = req.body.estado !== undefined ? req.body.estado : actual.estado;

    let prodArray = actual.productos;
    if (req.body.productos !== undefined) {
      prodArray = Array.isArray(req.body.productos)
        ? req.body.productos
        : String(req.body.productos).split(',').map((s) => s.trim()).filter(Boolean);
    }

    const upRes = await pool.query(
      `UPDATE proveedores
       SET nombre = $1, nit = $2, contacto = $3, telefono = $4, correo = $5,
           ciudad = $6, productos = $7::jsonb, estado = $8
       WHERE id = $9
       RETURNING *`,
      [nombre, nit, contacto, telefono, correo, ciudad, JSON.stringify(prodArray), estado, actual.id]
    );

    res.json({
      message: 'Proveedor actualizado exitosamente.',
      data: formatearProveedorRow(upRes.rows[0]),
    });
  } catch (error) {
    console.error('inventarioController.actualizarProveedor error:', error.message);
    res.status(500).json({ error: 'Error al actualizar proveedor.' });
  }
};

// Archivar proveedor
const archivarProveedor = async (req, res) => {
  try {
    const prvId = req.params.id;
    const upRes = await pool.query(
      'UPDATE proveedores SET archivado = true WHERE id::text = $1 OR codigo = $1 RETURNING *',
      [String(prvId).trim()]
    );
    if (upRes.rows.length === 0) {
      return res.status(404).json({ error: `Proveedor ${prvId} no encontrado.` });
    }
    res.json({
      message: 'Proveedor archivado exitosamente.',
      data: formatearProveedorRow(upRes.rows[0]),
    });
  } catch (error) {
    console.error('inventarioController.archivarProveedor error:', error.message);
    res.status(500).json({ error: 'Error al archivar proveedor.' });
  }
};

// Restaurar proveedor
const restaurarProveedor = async (req, res) => {
  try {
    const prvId = req.params.id;
    const upRes = await pool.query(
      'UPDATE proveedores SET archivado = false WHERE id::text = $1 OR codigo = $1 RETURNING *',
      [String(prvId).trim()]
    );
    if (upRes.rows.length === 0) {
      return res.status(404).json({ error: `Proveedor ${prvId} no encontrado.` });
    }
    res.json({
      message: 'Proveedor restaurado exitosamente.',
      data: formatearProveedorRow(upRes.rows[0]),
    });
  } catch (error) {
    console.error('inventarioController.restaurarProveedor error:', error.message);
    res.status(500).json({ error: 'Error al restaurar proveedor.' });
  }
};

// Eliminar proveedor seguro
const eliminarProveedor = async (req, res) => {
  try {
    const prvId = req.params.id;
    const findRes = await pool.query(
      'SELECT * FROM proveedores WHERE id::text = $1 OR codigo = $1 LIMIT 1',
      [String(prvId).trim()]
    );
    if (findRes.rows.length === 0) {
      return res.status(404).json({ error: `Proveedor ${prvId} no encontrado.` });
    }
    const prv = findRes.rows[0];

    // Verificar si algún material en inventario está asignado a este proveedor
    const matCheck = await pool.query(
      'SELECT COUNT(*)::int AS total FROM inventario WHERE proveedor_id = $1 OR proveedor_codigo = $2',
      [prv.id, prv.codigo]
    );
    if (matCheck.rows[0].total > 0) {
      return res.status(400).json({
        error: `No es posible eliminar el proveedor "${prv.nombre}" porque tiene ${matCheck.rows[0].total} material(es) asignados en el catálogo de inventario. Le recomendamos archivarlo.`,
      });
    }

    await pool.query('DELETE FROM proveedores WHERE id = $1', [prv.id]);
    res.json({
      message: `Proveedor "${prv.nombre}" eliminado permanentemente.`,
      id: prv.codigo || prv.id,
    });
  } catch (error) {
    console.error('inventarioController.eliminarProveedor error:', error.message);
    res.status(500).json({ error: 'Error al eliminar proveedor.' });
  }
};

module.exports = {
  listarInventario,
  crearMaterial,
  actualizarMaterial,
  archivarMaterial,
  restaurarMaterial,
  eliminarMaterial,
  listarProveedores,
  crearProveedor,
  actualizarProveedor,
  archivarProveedor,
  restaurarProveedor,
  eliminarProveedor,
  listarMovimientos,
  registrarMovimiento,
  reservarMateriales,
  liberarReservas,
};
