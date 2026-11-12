// ============================================================
// controllers/dashboardController.js — Controlador de Dashboard
// ============================================================
const { pool } = require('../db');
const { normalizarRol } = require('../middleware/auth');

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

const ETAPAS_UI_MAP = {
  0: 'Solicitud',
  1: 'Diseño',
  2: 'Aprobación',
  3: 'Preprensa',
  4: 'Impresión',
  5: 'Acabados',
  6: 'Calidad',
  7: 'Despacho',
  8: 'Entrega',
};

function parseFechaTexto(texto) {
  if (!texto) return null;
  if (texto instanceof Date) return texto;
  if (typeof texto === 'string' && texto.includes('/')) {
    const [dia, mes, anio] = texto.split('/').map(Number);
    return new Date(anio, mes - 1, dia);
  }
  return new Date(texto);
}

// Obtener resumen ejecutivo y KPIs del dashboard
const obtenerMetricas = async (req, res) => {
  try {
    const rolUsuario = normalizarRol(req.usuario?.rol || req.usuario?.rol_normalizado || 'gerente');
    const esRolOperativoSinFinanciero = ['disenador', 'produccion', 'operario', 'cliente'].includes(rolUsuario);

    // 1. Conteo y detalle de órdenes
    const ordRes = await pool.query(`
      SELECT
        id, codigo, etapa, estado_nombre, fecha_entrega, bloqueado, presupuesto, created_at, updated_at
      FROM ordenes;
    `);

    const totalOrdenes = ordRes.rowCount;
    const activas = ordRes.rows.filter(o => o.etapa < 8);
    const finalizadas = ordRes.rows.filter(o => o.etapa >= 8);
    const bloqueadas = ordRes.rows.filter(o => o.bloqueado);

    // Criterio temporal unificado con normalización a medianoche
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let retrasadasCount = 0;
    for (const o of activas) {
      if (o.fecha_entrega) {
        const fDate = parseFechaTexto(o.fecha_entrega);
        if (fDate && !isNaN(fDate.getTime())) {
          fDate.setHours(0, 0, 0, 0);
          if (fDate < hoy) {
            retrasadasCount++;
          }
        }
      }
    }

    // Cumplimiento de entregas sobre el universo total de órdenes comprometidas (null si no hay órdenes)
    const enPlazoTotal = Math.max(0, totalOrdenes - retrasadasCount);
    const aTiempoPct = totalOrdenes > 0
      ? Math.round((enPlazoTotal / totalOrdenes) * 100)
      : null;

    const totalPresupuesto = esRolOperativoSinFinanciero
      ? undefined
      : ordRes.rows.reduce((sum, o) => sum + Number(o.presupuesto || 0), 0);

    // 2. Órdenes por cada etapa (flujo Kanban completo)
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

    // 3. Distribución por prioridad activa
    const prioridadRes = await pool.query(`
      SELECT prioridad, COUNT(*) AS total
      FROM ordenes
      WHERE etapa < 8
      GROUP BY prioridad;
    `);

    // 4. Solicitudes comerciales
    const solRes = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'en_validacion')::int AS en_validacion,
        COUNT(*) FILTER (WHERE estado = 'aprobada')::int AS aprobadas,
        COUNT(*) FILTER (WHERE estado = 'rechazada')::int AS rechazadas
      FROM solicitudes;
    `);

    // 5. Actividades de taller (tareas)
    const tarRes = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'Pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE estado IN ('En Proceso', 'En proceso', 'Iniciada'))::int AS en_proceso,
        COUNT(*) FILTER (WHERE estado = 'Finalizada')::int AS finalizadas,
        COALESCE(ROUND(AVG(porcentaje)::numeric, 1), 0)::float AS promedio_avance
      FROM tareas;
    `);

    // 6. Postventa y satisfacción
    const postventaStatsRes = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'Abierto')::int AS abiertos,
        COUNT(*) FILTER (WHERE estado = 'En trámite')::int AS en_tramite,
        COUNT(*) FILTER (WHERE estado = 'En reposición')::int AS en_reposicion,
        COUNT(*) FILTER (WHERE estado = 'Resuelto')::int AS resueltos,
        COALESCE(ROUND(AVG(nivel_conformidad)::numeric, 1), 0)::float AS promedio_satisfaccion,
        COUNT(*) FILTER (WHERE nivel_conformidad IS NOT NULL)::int AS total_evaluaciones
      FROM postventa;
    `);

    // 7. Aprobación de artes en primera versión (eficiencia sobre diseños concluidos y evaluados)
    const arteRes = await pool.query(`
      SELECT
        COUNT(DISTINCT a.orden_id) FILTER (WHERE evaluado.aprobada_en_v1 = true)::int AS aprobadas_v1,
        COUNT(DISTINCT a.orden_id) FILTER (WHERE evaluado.tiene_aprobado = true)::int AS total_evaluadas,
        COUNT(DISTINCT a.orden_id) FILTER (WHERE evaluado.tiene_aprobado = false)::int AS total_pendientes,
        COUNT(DISTINCT a.orden_id)::int AS total_con_arte
      FROM archivos_arte a
      INNER JOIN ordenes o ON a.orden_id = o.id
      INNER JOIN (
        SELECT
          orden_id,
          BOOL_OR(estado_aprobacion = 'aprobado') AS tiene_aprobado,
          (
            BOOL_OR(numero_version = 1 AND estado_aprobacion = 'aprobado') = true
            AND MAX(numero_version) = 1
          ) AS aprobada_en_v1
        FROM archivos_arte
        GROUP BY orden_id
      ) evaluado ON a.orden_id = evaluado.orden_id;
    `);

    const arteStats = arteRes.rows[0] || {
      aprobadas_v1: 0,
      total_evaluadas: 0,
      total_pendientes: 0,
      total_con_arte: 0,
    };

    const aprobadosPrimeraVersionPct = arteStats.total_evaluadas > 0
      ? Math.round((arteStats.aprobadas_v1 / arteStats.total_evaluadas) * 100)
      : null;

    // 8. Carga de tareas por usuario (colaboradores operativos)
    const cargaRes = await pool.query(`
      SELECT
        u.nombre_completo AS label,
        COUNT(t.id)::int AS value
      FROM usuarios u
      LEFT JOIN tareas t ON u.id = t.owner_id AND t.estado != 'Finalizada'
      WHERE u.rol != 'gerente' AND u.esta_activo = true
      GROUP BY u.id, u.nombre_completo
      ORDER BY value DESC, label ASC;
    `);

    // 9. Comunicaciones reales: discriminación estricta de conversaciones y mensajes individuales
    const commRes = await pool.query(`
      SELECT
        CASE
          WHEN LOWER(c.canal::text) IN ('wa', 'whatsapp') THEN 'WhatsApp'
          WHEN LOWER(c.canal::text) IN ('mail', 'correo', 'email') THEN 'Correo'
          WHEN LOWER(c.canal::text) IN ('call', 'telefono', 'telefonia') THEN 'Telefonía'
          ELSE 'Otro'
        END AS canal_nombre,
        COUNT(DISTINCT c.id)::int AS total_conversaciones,
        COUNT(m.id)::int AS total_mensajes
      FROM canales_contacto c
      LEFT JOIN mensajes_entrantes m ON c.id = m.canal_id
      GROUP BY 1;
    `);

    const commMap = new Map(commRes.rows.map(r => [r.canal_nombre, r]));
    const canalesLista = ['WhatsApp', 'Correo', 'Telefonía'];
    const colores = { WhatsApp: 'verde', Correo: 'azul', Telefonía: 'amarillo' };

    const conversacionesPorCanal = canalesLista.map(nombre => ({
      label: nombre,
      value: commMap.get(nombre)?.total_conversaciones || 0,
      mensajes: commMap.get(nombre)?.total_mensajes || 0,
      color: colores[nombre],
    }));

    const mensajesPorCanal = canalesLista.map(nombre => ({
      label: nombre,
      value: commMap.get(nombre)?.total_mensajes || 0,
      color: colores[nombre],
    }));

    const totalConversaciones = conversacionesPorCanal.reduce((s, c) => s + c.value, 0);
    const totalMensajes = mensajesPorCanal.reduce((s, c) => s + c.value, 0);

    // 10. Órdenes activas por etapa (Donut de Producción)
    const etapasUi = ['Diseño', 'Aprobación', 'Impresión', 'Acabados', 'Despacho'];
    const porEtapa = etapasUi.map(etapaNombre => {
      const val = activas.filter(o => {
        const nom = o.estado_nombre || ETAPAS_UI_MAP[o.etapa] || '';
        return nom.toLowerCase().includes(etapaNombre.toLowerCase());
      }).length;
      return { label: etapaNombre, value: val };
    });

    // Cuello de botella: etapa activa con más órdenes acumuladas
    const cuello = [...porEtapa].sort((a, b) => b.value - a.value)[0] || { label: 'Diseño', value: 0 };

    // 11. Top 5 Clientes con mayor número de órdenes activas
    const topClientesRes = await pool.query(`
      SELECT
        c.id,
        c.empresa,
        COUNT(o.id)::int AS ordenes_activas
      FROM clientes c
      INNER JOIN ordenes o ON c.id = o.cliente_id AND o.etapa < 8
      GROUP BY c.id, c.empresa
      ORDER BY ordenes_activas DESC
      LIMIT 5;
    `);

    // 12. Ciclo promedio de orden en días: desde la fecha de solicitud hasta el cierre formal.
    // updated_at no se actualiza en cada cambio, por lo que no sirve como fecha de cierre.
    const cicloRes = await pool.query(`
      SELECT
        ROUND(AVG(TO_DATE(fecha_cierre, 'DD/MM/YYYY') - TO_DATE(fecha_solicitud, 'DD/MM/YYYY'))::numeric, 1)::float AS ciclo_promedio,
        COUNT(*)::int AS ordenes_medidas
      FROM ordenes
      WHERE etapa >= 8
        AND fecha_cierre ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
        AND fecha_solicitud ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
        AND TO_DATE(fecha_cierre, 'DD/MM/YYYY') >= TO_DATE(fecha_solicitud, 'DD/MM/YYYY');
    `);
    const cicloPromedioDias = cicloRes.rows[0]?.ordenes_medidas > 0 && cicloRes.rows[0]?.ciclo_promedio != null
      ? cicloRes.rows[0].ciclo_promedio
      : null;

    // Filtrado de seguridad según rol:
    // Gerencia recibe el reporte ejecutivo integral con métricas financieras y comerciales.
    // Coordinación recibe únicamente los indicadores operativos de planta y taller.
    const esGerencia = rolUsuario === 'gerente';

    // 13. Tiempos promedio reales por etapa (calculados desde orden_etapa_historial)
    let tiemposPromedioItems = [];
    let hayTelemetriaEtapas = false;
    try {
      const tiemposRes = await pool.query(`
        SELECT
          etapa_nombre AS label,
          ROUND(AVG(tiempo_segundos) / 3600.0, 1)::float AS value_horas,
          ROUND(AVG(tiempo_segundos) / 86400.0, 1)::float AS value,
          COUNT(*)::int AS mediciones
        FROM orden_etapa_historial
        WHERE tiempo_segundos IS NOT NULL AND tiempo_segundos > 0
        GROUP BY etapa_nombre
        ORDER BY MIN(etapa_nueva) ASC;
      `);
      if (tiemposRes.rowCount > 0) {
        tiemposPromedioItems = tiemposRes.rows;
        hayTelemetriaEtapas = true;
      }
    } catch (_) {}

    const payload = {
      resumen: {
        total_ordenes: totalOrdenes,
        activas: activas.length,
        finalizadas: finalizadas.length,
        bloqueadas: bloqueadas.length,
        retrasadas: retrasadasCount,
        a_tiempo_pct: aTiempoPct,
        ...(esGerencia && totalPresupuesto !== undefined ? { total_presupuestado: totalPresupuesto } : {}),
        solicitudes: esGerencia ? solRes.rows[0] : undefined,
        actividades: tarRes.rows[0],
        postventa: esGerencia ? postventaStatsRes.rows[0] : undefined,
        promedio_satisfaccion_estrellas: esGerencia ? postventaStatsRes.rows[0].promedio_satisfaccion : undefined,
        total_evaluaciones_postventa: esGerencia ? postventaStatsRes.rows[0].total_evaluaciones : undefined,
        eficiencia_diseno: {
          aprobados_primera_version_pct: aprobadosPrimeraVersionPct,
          aprobadas_v1: arteStats.aprobadas_v1,
          total_evaluadas: arteStats.total_evaluadas,
          total_pendientes: arteStats.total_pendientes,
          total_con_arte: arteStats.total_con_arte,
        },
        aprobados_primera_version_pct: aprobadosPrimeraVersionPct,
        total_artes_evaluados: arteStats.total_evaluadas,
        artes_pendientes_evaluacion: arteStats.total_pendientes,
        ciclo_promedio_dias: esGerencia ? cicloPromedioDias : undefined,
        ...(esGerencia ? {
          comunicaciones_totales: {
            conversaciones: totalConversaciones,
            mensajes: totalMensajes,
          },
        } : {}),
      },
      embudo_produccion_kanban: embudoEtapas,
      ordenes_activas_por_etapa: porEtapa,
      cuello_de_botella: cuello,
      prioridades_activas: prioridadRes.rows,
      carga_usuarios: cargaRes.rows,
      ...(esGerencia ? {
        comunicaciones: {
          conversaciones_por_canal: conversacionesPorCanal,
          mensajes_por_canal: mensajesPorCanal,
          total_conversaciones: totalConversaciones,
          total_mensajes: totalMensajes,
        },
        comunicaciones_por_canal: conversacionesPorCanal,
        top_clientes_activos: topClientesRes.rows,
      } : {}),
      // Tiempos promedio por etapa: dinámico según orden_etapa_historial
      tiempos_promedio_etapa: {
        disponible: hayTelemetriaEtapas,
        mensaje: hayTelemetriaEtapas ? 'Consolidado histórico de transiciones' : 'Sin datos disponibles',
        items: tiemposPromedioItems,
      },
    };

    res.json(payload);
  } catch (error) {
    console.error('dashboardController.obtenerMetricas error:', error.message);
    res.status(500).json({ error: 'Error al generar métricas del dashboard.', detalle: error.message });
  }
};

module.exports = {
  obtenerMetricas,
};
