// ============================================================
// controllers/ordenesController.js — Controlador de Órdenes
// ============================================================
const { pool } = require('../db');

// Listar órdenes con filtros
const listarOrdenes = async (req, res) => {
  const { cliente_id, etapa, prioridad } = req.query;

  try {
    let queryText = `
      SELECT
        o.id,
        o.producto,
        o.etapa,
        o.prioridad,
        o.porcentaje_avance,
        o.bloqueado,
        o.created_at,
        o.updated_at,
        c.id AS cliente_id,
        c.empresa AS cliente_empresa,
        u_ejec.nombre_completo AS ejecutiva_nombre,
        u_dis.nombre_completo AS disenador_nombre,
        u_prod.nombre_completo AS produccion_nombre
      FROM ordenes o
      INNER JOIN clientes c ON o.cliente_id = c.id
      INNER JOIN usuarios u_ejec ON o.ejecutiva_id = u_ejec.id
      LEFT JOIN usuarios u_dis ON o.disenador_id = u_dis.id
      LEFT JOIN usuarios u_prod ON o.produccion_id = u_prod.id
      WHERE 1=1
    `;
    const params = [];

    if (cliente_id) {
      params.push(cliente_id);
      queryText += ` AND o.cliente_id = $${params.length}`;
    }
    if (etapa !== undefined) {
      params.push(parseInt(etapa, 10));
      queryText += ` AND o.etapa = $${params.length}`;
    }
    if (prioridad) {
      params.push(prioridad);
      queryText += ` AND o.prioridad = $${params.length}`;
    }

    queryText += ' ORDER BY o.created_at DESC';

    const result = await pool.query(queryText, params);
    res.json({
      total: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('ordenesController.listarOrdenes error:', error.message);
    res.status(500).json({ error: 'Error al listar las órdenes.', detalle: error.message });
  }
};

// Detalle de una orden por ID
const obtenerOrdenPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        o.*,
        c.empresa AS cliente_empresa,
        c.nit AS cliente_nit,
        c.contacto_principal AS cliente_contacto,
        u_ejec.nombre_completo AS ejecutiva_nombre,
        u_dis.nombre_completo AS disenador_nombre,
        u_prod.nombre_completo AS produccion_nombre
      FROM ordenes o
      INNER JOIN clientes c ON o.cliente_id = c.id
      INNER JOIN usuarios u_ejec ON o.ejecutiva_id = u_ejec.id
      LEFT JOIN usuarios u_dis ON o.disenador_id = u_dis.id
      LEFT JOIN usuarios u_prod ON o.produccion_id = u_prod.id
      WHERE o.id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Orden ${id} no encontrada.` });
    }

    // Consultar historial inmutable de la orden
    const historialRes = await pool.query(`
      SELECT
        r.id,
        r.accion_texto,
        r.created_at,
        u.nombre_completo AS responsable_nombre,
        u.rol AS responsable_rol
      FROM registro_sesion r
      INNER JOIN usuarios u ON r.usuario_responsable_id = u.id
      WHERE r.orden_id = $1
      ORDER BY r.created_at ASC
    `, [id]);

    res.json({
      data: result.rows[0],
      historial_sesion: historialRes.rows,
    });
  } catch (error) {
    console.error(`ordenesController.obtenerOrdenPorId error:`, error.message);
    res.status(500).json({ error: 'Error al obtener la orden.', detalle: error.message });
  }
};

/**
 * 1. TRANSACCIÓN: Creación de orden + Registro de Auditoría Inmutable
 */
const crearOrden = async (req, res) => {
  const { cliente_id, producto, ejecutiva_id, disenador_id, produccion_id, prioridad } = req.body;

  if (!cliente_id || !producto || !ejecutiva_id) {
    return res.status(400).json({
      error: 'Campos obligatorios: cliente_id, producto y ejecutiva_id.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar cliente
    const clienteRes = await client.query('SELECT id, empresa FROM clientes WHERE id = $1', [cliente_id]);
    if (clienteRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Cliente con ID ${cliente_id} no encontrado.` });
    }

    // 2. Validar ejecutiva
    const ejecutivaRes = await client.query(
      "SELECT id, nombre_completo FROM usuarios WHERE id = $1 AND rol = 'ejecutiva'",
      [ejecutiva_id]
    );
    if (ejecutivaRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La ejecutiva especificada no existe o no tiene el rol correspondiente.' });
    }

    // 3. Validar diseñador (si fue enviado)
    if (disenador_id) {
      const disRes = await client.query(
        "SELECT id FROM usuarios WHERE id = $1 AND rol = 'disenador'",
        [disenador_id]
      );
      if (disRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El diseñador especificado no existe o no tiene el rol de diseñador.' });
      }
    }

    // 4. Insertar la orden
    const insertRes = await client.query(`
      INSERT INTO ordenes (cliente_id, producto, ejecutiva_id, disenador_id, produccion_id, etapa, prioridad, porcentaje_avance)
      VALUES ($1, $2, $3, $4, $5, 0, $6, 0.00)
      RETURNING *
    `, [
      cliente_id,
      producto.trim(),
      ejecutiva_id,
      disenador_id || null,
      produccion_id || null,
      prioridad || 'Media',
    ]);

    const nuevaOrden = insertRes.rows[0];

    // 5. Auditoría simultánea en registro_sesion (Todo o nada)
    await client.query(`
      INSERT INTO registro_sesion (orden_id, usuario_responsable_id, accion_texto)
      VALUES ($1, $2, $3)
    `, [
      nuevaOrden.id,
      ejecutiva_id,
      `Creación de la orden #${nuevaOrden.id} ("${nuevaOrden.producto}") para el cliente "${clienteRes.rows[0].empresa}". Etapa inicial: 0 (Solicitud Recibida).`,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Orden de producción creada y auditada exitosamente.',
      data: nuevaOrden,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ordenesController.crearOrden error:', error.message);
    res.status(500).json({ error: 'Error al crear la orden.', detalle: error.message });
  } finally {
    client.release();
  }
};

/**
 * 2. CANDADO DE APROBACIÓN DE DISEÑO + 3. PASO A PRODUCCIÓN Y DESCUENTO DE STOCK
 * PATCH /api/ordenes/:id/etapa
 */
const actualizarEtapa = async (req, res) => {
  const ordenId = parseInt(req.params.id, 10);
  const {
    etapa,
    usuario_id,         // Usuario que ejecuta la acción (o usa req.usuario?.id)
    material_id,        // Opcional para descuento de stock
    cantidad_insumo,    // Cantidad a descontar
    observaciones,
  } = req.body;

  if (isNaN(ordenId)) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero.' });
  }

  if (etapa === undefined || etapa === null) {
    return res.status(400).json({ error: 'El campo etapa es obligatorio.' });
  }

  const nuevaEtapa = parseInt(etapa, 10);
  if (isNaN(nuevaEtapa) || nuevaEtapa < 0 || nuevaEtapa > 8) {
    return res.status(400).json({ error: 'La etapa debe ser un número entero entre 0 y 8.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener orden bloqueando la fila
    const ordenRes = await client.query(
      'SELECT id, bloqueado, etapa, producto, ejecutiva_id FROM ordenes WHERE id = $1 FOR UPDATE',
      [ordenId]
    );

    if (ordenRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${ordenId} no encontrada.` });
    }

    const orden = ordenRes.rows[0];

    if (orden.bloqueado) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La orden está bloqueada y no puede cambiar de etapa.' });
    }

    // Identificar usuario responsable para auditoría
    const responsableId = usuario_id || req.usuario?.id || orden.ejecutiva_id;
    const usuarioRes = await client.query(
      'SELECT id, nombre_completo FROM usuarios WHERE id = $1',
      [responsableId]
    );
    if (usuarioRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El usuario responsable no existe en el sistema.' });
    }
    const responsableNombre = usuarioRes.rows[0].nombre_completo;

    // ========================================================
    // CANDADO DE APROBACIÓN DE DISEÑO:
    // Las etapas >= 4 corresponden a Impresión, Confección y Producción
    // ========================================================
    if (nuevaEtapa >= 4 && orden.etapa < 4) {
      const arteAprobadoRes = await client.query(`
        SELECT id, numero_version, estado_aprobacion
        FROM archivos_arte
        WHERE orden_id = $1 AND estado_aprobacion = 'aprobado'
        ORDER BY numero_version DESC
        LIMIT 1
      `, [ordenId]);

      if (arteAprobadoRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'CANDADO DE CALIDAD: No se puede avanzar a la etapa de impresión/producción (etapa >= 4) sin un diseño en estado "aprobado".',
          detalle: 'Debes registrar y aprobar formalmente un archivo de arte antes de mandar a producción.',
        });
      }
    }

    // ========================================================
    // DESCUENTO DE STOCK EN INVENTARIO (Si se especificó material)
    // ========================================================
    let descuentoRealizado = null;
    if (material_id && cantidad_insumo) {
      const cantDescontar = parseFloat(cantidad_insumo);
      if (isNaN(cantDescontar) || cantDescontar <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La cantidad de insumo a descontar debe ser un número positivo.' });
      }

      // Bloquear fila del material para evitar condiciones de carrera (concurrency safe)
      const materialRes = await client.query(`
        SELECT id, nombre_material, stock_actual, stock_minimo
        FROM inventario
        WHERE id = $1 FOR UPDATE
      `, [material_id]);

      if (materialRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Material de inventario #${material_id} no encontrado.` });
      }

      const material = materialRes.rows[0];
      const stockActual = parseFloat(material.stock_actual);

      if (stockActual < cantDescontar) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Stock insuficiente para "${material.nombre_material}".`,
          disponible: stockActual,
          requerido: cantDescontar,
        });
      }

      // Descontar insumo
      await client.query(`
        UPDATE inventario
        SET stock_actual = stock_actual - $1
        WHERE id = $2
      `, [cantDescontar, material_id]);

      // Registrar salida en movimientos_inventario
      await client.query(`
        INSERT INTO movimientos_inventario (material_id, orden_id, usuario_responsable_id, cantidad, tipo)
        VALUES ($1, $2, $3, $4, 'salida')
      `, [material_id, ordenId, responsableId, cantDescontar]);

      descuentoRealizado = {
        material: material.nombre_material,
        cantidad_descontada: cantDescontar,
        stock_restante: stockActual - cantDescontar,
      };
    }

    // Actualizar orden
    const porcentaje = parseFloat(((nuevaEtapa / 8) * 100).toFixed(2));
    const updateRes = await client.query(`
      UPDATE ordenes
      SET etapa = $1, porcentaje_avance = $2
      WHERE id = $3
      RETURNING *
    `, [nuevaEtapa, porcentaje, ordenId]);

    // Registrar en auditoría inmutable
    let textoAuditoria = `Orden #${ordenId} movida de etapa ${orden.etapa} a etapa ${nuevaEtapa} (${porcentaje}% completado) por ${responsableNombre}.`;
    if (descuentoRealizado) {
      textoAuditoria += ` Se descontaron ${descuentoRealizado.cantidad_descontada} unidades del material "${descuentoRealizado.material}".`;
    }
    if (observaciones) {
      textoAuditoria += ` Nota: ${observaciones}`;
    }

    await client.query(`
      INSERT INTO registro_sesion (orden_id, usuario_responsable_id, accion_texto)
      VALUES ($1, $2, $3)
    `, [ordenId, responsableId, textoAuditoria]);

    await client.query('COMMIT');

    res.json({
      message: `Orden ${ordenId} actualizada exitosamente a etapa ${nuevaEtapa}.`,
      data: updateRes.rows[0],
      descuento_inventario: descuentoRealizado,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`ordenesController.actualizarEtapa error:`, error.message);
    res.status(500).json({ error: 'Error al actualizar etapa de la orden.', detalle: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  listarOrdenes,
  obtenerOrdenPorId,
  crearOrden,
  actualizarEtapa,
};
