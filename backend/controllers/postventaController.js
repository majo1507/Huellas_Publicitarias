// ============================================================
// controllers/postventaController.js — Controlador de Postventa y Calidad
// ============================================================
const { pool } = require('../db');

// Listar registros de postventa
const listarPostventa = async (req, res) => {
  const { orden_id, tipo } = req.query;

  try {
    let queryText = `
      SELECT
        pv.id,
        pv.orden_id,
        pv.tipo,
        pv.nivel_conformidad,
        pv.descripcion,
        pv.created_at,
        o.producto,
        c.empresa AS cliente_empresa,
        u.nombre_completo AS ejecutiva_nombre
      FROM postventa pv
      INNER JOIN ordenes o ON pv.orden_id = o.id
      INNER JOIN clientes c ON o.cliente_id = c.id
      INNER JOIN usuarios u ON pv.ejecutiva_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (orden_id) {
      params.push(parseInt(orden_id, 10));
      queryText += ` AND pv.orden_id = $${params.length}`;
    }
    if (tipo) {
      params.push(tipo);
      queryText += ` AND pv.tipo = $${params.length}`;
    }

    queryText += ' ORDER BY pv.created_at DESC';

    const result = await pool.query(queryText, params);
    res.json({
      total: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('postventaController.listarPostventa error:', error.message);
    res.status(500).json({ error: 'Error al consultar postventa.', detalle: error.message });
  }
};

// Crear evaluación, reclamo, garantía o acta de postventa (con soporte de archivo adjunto)
const crearPostventa = async (req, res) => {
  const { orden_id, ejecutiva_id, tipo, nivel_conformidad, descripcion } = req.body;

  const ordenIdInt = parseInt(orden_id, 10);
  if (isNaN(ordenIdInt) || !ejecutiva_id || !tipo) {
    return res.status(400).json({
      error: 'Campos obligatorios: orden_id (número), ejecutiva_id, tipo (Ajuste, Garantía, Reclamo, Comentario).',
    });
  }

  const tiposPermitidos = ['Ajuste', 'Garantía', 'Reclamo', 'Comentario'];
  if (!tiposPermitidos.includes(tipo)) {
    return res.status(400).json({
      error: `Tipo de postventa no válido. Opciones: ${tiposPermitidos.join(', ')}`,
    });
  }

  if (nivel_conformidad !== undefined && nivel_conformidad !== null && nivel_conformidad !== '') {
    const calif = parseInt(nivel_conformidad, 10);
    if (isNaN(calif) || calif < 1 || calif > 5) {
      return res.status(400).json({ error: 'El nivel de conformidad debe ser un número entero entre 1 y 5.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar orden
    const ordenRes = await client.query('SELECT id FROM ordenes WHERE id = $1', [ordenIdInt]);
    if (ordenRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${ordenIdInt} no encontrada.` });
    }

    // 2. Validar ejecutiva
    const ejecRes = await client.query(
      "SELECT id, nombre_completo FROM usuarios WHERE id = $1 AND rol = 'ejecutiva'",
      [ejecutiva_id]
    );
    if (ejecRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La ejecutiva especificada no existe o no tiene dicho rol.' });
    }

    // Si se subió un archivo físico (ej. acta de entrega o foto)
    let descripcionFinal = descripcion ? descripcion.trim() : '';
    let archivoInfo = null;
    if (req.file) {
      const rutaRelativa = `uploads/${req.file.filename}`;
      archivoInfo = {
        nombre_original: req.file.originalname,
        archivo: rutaRelativa,
        url: `/${rutaRelativa}`,
      };
      descripcionFinal = descripcionFinal
        ? `${descripcionFinal} [Adjunto: ${rutaRelativa}]`
        : `[Adjunto: ${rutaRelativa}]`;
    }

    const insertRes = await client.query(`
      INSERT INTO postventa (orden_id, ejecutiva_id, tipo, nivel_conformidad, descripcion)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      ordenIdInt,
      ejecutiva_id,
      tipo,
      nivel_conformidad ? parseInt(nivel_conformidad, 10) : null,
      descripcionFinal || null,
    ]);

    // Registrar en auditoría inmutable
    await client.query(`
      INSERT INTO registro_sesion (orden_id, usuario_responsable_id, accion_texto)
      VALUES ($1, $2, $3)
    `, [
      ordenIdInt,
      ejecutiva_id,
      `Registro de postventa tipo "${tipo}" con nivel de conformidad ${nivel_conformidad || 'N/A'}${archivoInfo ? ' (con archivo adjunto)' : ''}.`,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Registro de postventa creado exitosamente.',
      data: insertRes.rows[0],
      adjunto: archivoInfo,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('postventaController.crearPostventa error:', error.message);
    res.status(500).json({ error: 'Error al registrar postventa.', detalle: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  listarPostventa,
  crearPostventa,
};
