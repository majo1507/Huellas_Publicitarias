// ============================================================
// routes/dashboard.js — Métricas y Tablero General (KPIs)
// ============================================================
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Nombres legibles para cada etapa del embudo de producción (0 a 8)
const ETAPAS_HUELLAS = {
  0: '0. Solicitud Recibida',
  1: '1. Diseño en Proceso',
  2: '2. En Aprobación de Cliente',
  3: '3. Preprensa / Archivos Finales',
  4: '4. En Impresión',
  5: '5. Confección y Acabados',
  6: '6. Control de Calidad',
  7: '7. En Instalación / Despacho',
  8: '8. Entregada / Finalizada',
};

// GET /api/dashboard - Resumen ejecutivo de producción y operaciones
router.get('/', async (_req, res) => {
  try {
    // 1. Conteo total de órdenes activas vs finalizadas
    const totalesRes = await pool.query(`
      SELECT
        COUNT(*) AS total_ordenes,
        COUNT(*) FILTER (WHERE etapa < 8) AS activas,
        COUNT(*) FILTER (WHERE etapa = 8) AS finalizadas,
        COUNT(*) FILTER (WHERE bloqueado = true) AS bloqueadas
      FROM ordenes;
    `);

    // 2. Órdenes por cada etapa (flujo Kanban)
    const etapasRes = await pool.query(`
      SELECT etapa, COUNT(*) AS total
      FROM ordenes
      GROUP BY etapa
      ORDER BY etapa ASC;
    `);

    const embudoEtapas = Object.keys(ETAPAS_HUELLAS).map(etapaNum => {
      const num = parseInt(etapaNum, 10);
      const row = etapasRes.rows.find(r => r.etapa === num);
      return {
        etapa: num,
        nombre: ETAPAS_HUELLAS[num],
        total: row ? parseInt(row.total, 10) : 0,
      };
    });

    // 3. Distribución por prioridad
    const prioridadRes = await pool.query(`
      SELECT prioridad, COUNT(*) AS total
      FROM ordenes
      WHERE etapa < 8
      GROUP BY prioridad;
    `);

    // 4. Carga de trabajo actual por diseñador
    const disenadoresRes = await pool.query(`
      SELECT
        u.id,
        u.nombre_completo,
        COUNT(o.id) AS ordenes_en_proceso
      FROM usuarios u
      LEFT JOIN ordenes o ON u.id = o.disenador_id AND o.etapa < 8
      WHERE u.rol = 'disenador' AND u.esta_activo = true
      GROUP BY u.id, u.nombre_completo
      ORDER BY ordenes_en_proceso DESC;
    `);

    // 5. Promedio de satisfacción de clientes en Postventa
    const postventaStatsRes = await pool.query(`
      SELECT
        ROUND(AVG(nivel_conformidad)::numeric, 2) AS promedio_satisfaccion,
        COUNT(*) AS total_evaluaciones
      FROM postventa
      WHERE nivel_conformidad IS NOT NULL;
    `);

    // 6. Top 5 Clientes con mayor número de órdenes activas
    const topClientesRes = await pool.query(`
      SELECT
        c.id,
        c.empresa,
        COUNT(o.id) AS ordenes_activas
      FROM clientes c
      INNER JOIN ordenes o ON c.id = o.cliente_id AND o.etapa < 8
      GROUP BY c.id, c.empresa
      ORDER BY ordenes_activas DESC
      LIMIT 5;
    `);

    res.json({
      resumen: {
        total_ordenes: parseInt(totalesRes.rows[0].total_ordenes, 10),
        activas: parseInt(totalesRes.rows[0].activas, 10),
        finalizadas: parseInt(totalesRes.rows[0].finalizadas, 10),
        bloqueadas: parseInt(totalesRes.rows[0].bloqueadas, 10),
        promedio_satisfaccion_estrellas: parseFloat(postventaStatsRes.rows[0].promedio_satisfaccion || 0),
        total_evaluaciones_postventa: parseInt(postventaStatsRes.rows[0].total_evaluaciones, 10),
      },
      embudo_produccion_kanban: embudoEtapas,
      prioridades_activas: prioridadRes.rows,
      carga_disenadores: disenadoresRes.rows,
      top_clientes_activos: topClientesRes.rows,
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error.message);
    res.status(500).json({ error: 'Error al generar métricas del dashboard.', detalle: error.message });
  }
});

module.exports = router;
