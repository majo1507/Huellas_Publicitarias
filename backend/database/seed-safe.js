// ============================================================
// database/seed-safe.js — Poblamiento IDEMPOTENTE y NO DESTRUCTIVO
// NO ejecuta TRUNCATE ni DELETE. Inserta los datos iniciales de ORVEX
// solo si aún no existen en la base de datos.
// ============================================================
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const ETAPA_NUM_BY_ESTADO = {
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

const ESTADO_ARTE_DB = {
  'En proceso': 'borrador',
  Enviada: 'pendiente',
  Aprobada: 'aprobado',
  Rechazada: 'rechazado',
};

const ESTADO_SOL_DB = {
  Pendiente: 'pendiente',
  'En validación': 'en_validacion',
  Aprobada: 'aprobada',
  'Devuelta para corrección': 'devuelta',
  Rechazada: 'rechazada',
};

async function runSafeSeed() {
  const client = await pool.connect();
  console.log('🌱  [Seed Seguro] Poblando datos iniciales de ORVEX de forma idempotente...');

  try {
    await client.query('BEGIN');

    // 1. Usuarios del sistema (equipo interno + cuentas de acceso rápido de Login)
    const usuariosIniciales = [
      // Los 7 usuarios de la tabla de Usuarios (initialUsers) + sus credenciales de Login
      { codigo: 'U1', nombre: 'Ana Martínez', email: 'ana.martinez@huellas.co', pass: 'comercial123', rol: 'ejecutiva', cargo: 'Comercial / Recepción' },
      { codigo: 'U2', nombre: 'Carlos Ruiz', email: 'carlos.gomez@huellas.co', pass: 'coord123', rol: 'coord', cargo: 'Coordinador de producción' },
      { codigo: 'U3', nombre: 'María López', email: 'maria.lopez@huellas.co', pass: 'diseno123', rol: 'disenador', cargo: 'Diseñadora gráfica' },
      { codigo: 'U4', nombre: 'Juan Pérez', email: 'pedro.morales@huellas.co', pass: 'taller123', rol: 'produccion', cargo: 'Operario de impresión' },
      { codigo: 'U5', nombre: 'Pedro Ramírez', email: 'pedro.ramirez@huellas.co', pass: 'taller123', rol: 'produccion', cargo: 'Operario de acabados' },
      { codigo: 'U6', nombre: 'Sofía Herrera', email: 'sofia.herrera@huellas.co', pass: 'post123', rol: 'postventa', cargo: 'Atención postventa' },
      { codigo: 'U7', nombre: 'Andrés Torres', email: 'laura.sanchez@huellas.co', pass: 'gerencia123', rol: 'gerente', cargo: 'Gerente general' },
    ];

    const uByCode = {};
    const uByName = {};

    for (const u of usuariosIniciales) {
      const hash = bcrypt.hashSync(u.pass, 10);
      const res = await client.query(`
        INSERT INTO usuarios (codigo, nombre_completo, email, password_hash, rol, cargo, esta_activo)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (email) DO UPDATE
          SET codigo = COALESCE(usuarios.codigo, EXCLUDED.codigo),
              cargo = COALESCE(usuarios.cargo, EXCLUDED.cargo),
              password_hash = COALESCE(usuarios.password_hash, EXCLUDED.password_hash)
        RETURNING id, codigo, nombre_completo, email, rol
      `, [u.codigo, u.nombre, u.email, hash, u.rol, u.cargo]);
      const row = res.rows[0];
      uByCode[u.codigo] = row.id;
      uByName[u.nombre] = row.id;
    }
    console.log(`    ✅ ${usuariosIniciales.length} usuarios base verificados.`);

    const ejecutivaDefault = uByCode['U1'];
    const disenadoraDefault = uByCode['U3'];
    const coordDefault = uByCode['U2'];
    const prodJuan = uByCode['U4'];
    const prodPedro = uByCode['U5'];

    // 2. Clientes (C1 .. C8)
    const clientesIniciales = [
      { codigo: 'C1', nombre: 'Empresa ABC', nit: '900100101-1', contacto: 'Laura Gómez', telefono: '300 111 2233', correo: 'laura@empresaabc.test', direccion: 'Cra 15 # 80-20', ciudad: 'Bogotá' },
      { codigo: 'C2', nombre: 'Comercial XYZ', nit: '900100102-2', contacto: 'Mario Díaz', telefono: '301 222 3344', correo: 'mario@comercialxyz.test', direccion: 'Calle 45 # 12-30', ciudad: 'Medellín' },
      { codigo: 'C3', nombre: 'Café Central', nit: '900100103-3', contacto: 'Paula Ortiz', telefono: '302 333 4455', correo: 'paula@cafecentral.test', direccion: 'Cra 7 # 32-10', ciudad: 'Bogotá' },
      { codigo: 'C4', nombre: 'Gimnasio Fuerza', nit: '900100104-4', contacto: 'Diego Castro', telefono: '303 444 5566', correo: 'diego@gimnasiofuerza.test', direccion: 'Av. 68 # 45-12', ciudad: 'Bogotá' },
      { codigo: 'C5', nombre: 'Droguería Salud Total', nit: '900100105-5', contacto: 'Natalia Rojas', telefono: '304 555 6677', correo: 'natalia@saludtotal.test', direccion: 'Calle 100 # 15-40', ciudad: 'Cali' },
      { codigo: 'C6', nombre: 'Constructora Andes', nit: '900100106-6', contacto: 'Felipe Vargas', telefono: '305 666 7788', correo: 'felipe@constructoraandes.test', direccion: 'Cra 50 # 20-15', ciudad: 'Medellín' },
      { codigo: 'C7', nombre: 'Colegio San Marcos', nit: '900100107-7', contacto: 'Rosa Medina', telefono: '306 777 8899', correo: 'rosa@sanmarcos.test', direccion: 'Calle 63 # 24-50', ciudad: 'Bogotá' },
      { codigo: 'C8', nombre: 'Restaurante El Fogón', nit: '900100108-8', contacto: 'Camilo Peña', telefono: '307 888 9900', correo: 'camilo@elfogon.test', direccion: 'Cra 13 # 85-25', ciudad: 'Bogotá' },
    ];

    const cByCode = {};
    const cMetaByCode = {};
    for (const c of clientesIniciales) {
      const res = await client.query(`
        INSERT INTO clientes (codigo, empresa, nit, contacto_principal, telefono, correo, direccion, ciudad, ejecutiva_id, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Activo')
        ON CONFLICT (nit) DO UPDATE
          SET codigo = COALESCE(clientes.codigo, EXCLUDED.codigo),
              direccion = COALESCE(clientes.direccion, EXCLUDED.direccion),
              ciudad = COALESCE(clientes.ciudad, EXCLUDED.ciudad)
        RETURNING id, codigo
      `, [c.codigo, c.nombre, c.nit, c.contacto, c.telefono, c.correo, c.direccion, c.ciudad, ejecutivaDefault]);
      cByCode[c.codigo] = res.rows[0].id;
      cMetaByCode[c.codigo] = c;
    }
    console.log(`    ✅ ${clientesIniciales.length} clientes base verificados.`);

    // 3. Órdenes iniciales (OP-2026-0001 .. OP-2026-0012)
    const ev = (fecha, hora, actividad, responsable, estado = 'Completado', interno = false) => ({ fecha, hora, actividad, responsable, estado, interno });
    const ver = (numero, fecha, estado, comentario = '') => ({ numero, fecha, disenador: 'María López', estado, comentario });

    const ordenesIniciales = [
      {
        n: 1, clienteId: 'C1', producto: 'Pendón publicitario', cantidad: 5, material: 'Lona', dimensiones: '2m x 1m',
        colores: 'Azul y verde corporativo', acabados: 'Ojales y refuerzo', fechaSolicitud: '28/09/2026', fechaEntrega: '10/10/2026',
        estado: 'Impresión', disenoEstado: 'Aprobado', responsable: 'Juan Pérez', presupuesto: 350000, metodoEntrega: 'Domicilio',
        requerimientos: 'Logo en alta resolución, colores corporativos.', observaciones: 'Entregar en la sede principal.',
        versiones: [ver(1, '29/09/2026', 'Aprobada')],
        historial: [
          ev('28/09/2026', '09:15', 'Solicitud creada', 'Ana Martínez'),
          ev('28/09/2026', '10:40', 'Orden generada', 'Carlos Ruiz'),
          ev('28/09/2026', '11:00', 'Actividad asignada: diseño a María López', 'Carlos Ruiz', 'Completado', true),
          ev('29/09/2026', '14:20', 'Diseño creado (versión 1)', 'María López'),
          ev('30/09/2026', '08:50', 'Diseño enviado al cliente', 'María López'),
          ev('30/09/2026', '16:05', 'Diseño aprobado', 'Laura Gómez'),
          ev('01/10/2026', '09:00', 'Orden enviada a impresión', 'Carlos Ruiz'),
        ],
      },
      {
        n: 2, clienteId: 'C2', producto: 'Papelería corporativa', cantidad: 100, material: 'Papel', dimensiones: 'Carta',
        colores: 'Negro y azul', acabados: 'Corte y empaque', fechaSolicitud: '01/10/2026', fechaEntrega: '12/10/2026',
        estado: 'Diseño', disenoEstado: 'En proceso', responsable: 'María López', presupuesto: 220000, metodoEntrega: 'Domicilio',
        requerimientos: 'Hojas membretadas y tarjetas de presentación.', observaciones: '',
        versiones: [ver(1, '02/10/2026', 'En proceso')],
        historial: [
          ev('01/10/2026', '10:10', 'Solicitud creada', 'Ana Martínez'),
          ev('01/10/2026', '11:30', 'Orden generada', 'Carlos Ruiz'),
          ev('02/10/2026', '09:20', 'Diseño creado (versión 1)', 'María López'),
        ],
      },
      {
        n: 3, clienteId: 'C1', producto: 'Vinilo para vitrina', cantidad: 2, material: 'Vinilo adhesivo', dimensiones: '1.5m x 1m',
        colores: 'Verde y blanco', acabados: 'Laminado mate', fechaSolicitud: '29/09/2026', fechaEntrega: '13/10/2026',
        estado: 'Aprobación', disenoEstado: 'Enviado', responsable: 'María López', presupuesto: 180000, metodoEntrega: 'Instalación en sitio',
        requerimientos: 'Incluir horario de atención.', observaciones: 'Instalar en horario de la mañana.',
        versiones: [
          ver(1, '30/09/2026', 'Rechazada', 'Cambiar el color del logo al verde corporativo.'),
          ver(2, '02/10/2026', 'Enviada'),
        ],
        historial: [
          ev('29/09/2026', '08:45', 'Solicitud creada', 'Ana Martínez'),
          ev('29/09/2026', '10:00', 'Orden generada', 'Carlos Ruiz'),
          ev('30/09/2026', '15:30', 'Diseño enviado al cliente', 'María López'),
          ev('01/10/2026', '09:40', 'Diseño rechazado: cambiar el color del logo al verde corporativo.', 'Laura Gómez', 'Pendiente'),
          ev('02/10/2026', '16:15', 'Diseño enviado para aprobación (versión 2)', 'María López'),
        ],
      },
      {
        n: 4, clienteId: 'C3', producto: 'Volantes promocionales', cantidad: 500, material: 'Papel propalcote', dimensiones: 'Media carta',
        colores: 'Rojo y negro', acabados: 'Sin acabados', fechaSolicitud: '30/09/2026', fechaEntrega: '09/10/2026',
        estado: 'Diseño', disenoEstado: 'Requiere cambios', responsable: 'María López', presupuesto: 120000, metodoEntrega: 'Recoge en taller',
        requerimientos: 'Impresión a full color por ambas caras.', observaciones: '',
        versiones: [ver(1, '01/10/2026', 'Rechazada', 'El logo se ve muy pequeño; aumentar su tamaño.')],
        historial: [
          ev('30/09/2026', '11:00', 'Solicitud creada', 'Ana Martínez'),
          ev('30/09/2026', '14:00', 'Orden generada', 'Carlos Ruiz'),
          ev('01/10/2026', '10:30', 'Diseño enviado al cliente', 'María López'),
          ev('02/10/2026', '08:55', 'Diseño rechazado: el logo se ve muy pequeño; aumentar su tamaño.', 'Paula Ortiz', 'Pendiente'),
        ],
      },
      {
        n: 5, clienteId: 'C4', producto: 'Plegables informativos', cantidad: 300, material: 'Papel bond 90g', dimensiones: 'Tríptico carta',
        colores: 'Naranja y gris', acabados: 'Plegado', fechaSolicitud: '20/09/2026', fechaEntrega: '02/10/2026',
        estado: 'Impresión', disenoEstado: 'Aprobado', responsable: 'Juan Pérez', presupuesto: 260000, metodoEntrega: 'Recoge en taller',
        requerimientos: '', observaciones: '',
        versiones: [ver(1, '22/09/2026', 'Aprobada')],
        historial: [
          ev('20/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
          ev('21/09/2026', '10:00', 'Orden generada', 'Carlos Ruiz'),
          ev('25/09/2026', '11:00', 'Diseño aprobado', 'Diego Castro'),
          ev('29/09/2026', '08:00', 'Orden enviada a impresión', 'Carlos Ruiz'),
        ],
      },
      {
        n: 6, clienteId: 'C5', producto: 'Cajas para empaque', cantidad: 200, material: 'Cartulina', dimensiones: '20cm x 15cm x 10cm',
        colores: 'Verde y blanco', acabados: 'Laminado y troquelado', fechaSolicitud: '18/09/2026', fechaEntrega: '01/10/2026',
        estado: 'Acabados', disenoEstado: 'Aprobado', responsable: 'Pedro Ramírez', presupuesto: 840000, metodoEntrega: 'Domicilio',
        requerimientos: '', observaciones: '',
        versiones: [ver(1, '20/09/2026', 'Aprobada')],
        historial: [
          ev('18/09/2026', '09:30', 'Solicitud creada', 'Ana Martínez'),
          ev('19/09/2026', '10:00', 'Orden generada', 'Carlos Ruiz'),
          ev('24/09/2026', '15:00', 'Diseño aprobado', 'Natalia Rojas'),
          ev('26/09/2026', '09:00', 'Impresión finalizada', 'Juan Pérez'),
        ],
      },
      {
        n: 7, clienteId: 'C6', producto: 'Valla publicitaria', cantidad: 1, material: 'Lona banner', dimensiones: '6m x 3m',
        colores: 'Amarillo y gris', acabados: 'Marco metálico', fechaSolicitud: '02/10/2026', fechaEntrega: '20/10/2026',
        estado: 'Diseño', disenoEstado: 'Pendiente', responsable: 'María López', presupuesto: 1500000, metodoEntrega: 'Instalación en sitio',
        requerimientos: 'Incluir teléfono y dirección de la obra.', observaciones: '',
        versiones: [],
        historial: [
          ev('02/10/2026', '15:00', 'Solicitud creada', 'Ana Martínez'),
          ev('03/10/2026', '08:30', 'Orden generada', 'Carlos Ruiz'),
          ev('03/10/2026', '08:35', 'Actividad asignada: diseño a María López', 'Carlos Ruiz', 'Completado', true),
        ],
      },
      {
        n: 8, clienteId: 'C7', producto: 'Agendas institucionales', cantidad: 80, material: 'Papel bond y cartón', dimensiones: 'A5',
        colores: 'Azul y dorado', acabados: 'Encuadernación argollada', fechaSolicitud: '22/09/2026', fechaEntrega: '06/10/2026',
        estado: 'Acabados', disenoEstado: 'Aprobado', responsable: 'Pedro Ramírez', presupuesto: 960000, metodoEntrega: 'Domicilio',
        requerimientos: '', observaciones: '',
        versiones: [ver(1, '24/09/2026', 'Aprobada')],
        historial: [
          ev('22/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
          ev('22/09/2026', '12:00', 'Orden generada', 'Carlos Ruiz'),
          ev('27/09/2026', '10:00', 'Diseño aprobado', 'Rosa Medina'),
          ev('01/10/2026', '14:00', 'Impresión finalizada', 'Juan Pérez'),
        ],
      },
      {
        n: 9, clienteId: 'C1', producto: 'Tarjetas de presentación', cantidad: 250, material: 'Cartulina 300g', dimensiones: '9cm x 5cm',
        colores: 'Azul y verde', acabados: 'Laminado mate', fechaSolicitud: '15/09/2026', fechaEntrega: '26/09/2026',
        estado: 'Entrega', disenoEstado: 'Aprobado', responsable: 'Sofía Herrera', presupuesto: 90000, metodoEntrega: 'Domicilio',
        requerimientos: '', observaciones: 'Entregado a recepción.',
        versiones: [ver(1, '16/09/2026', 'Aprobada')],
        historial: [
          ev('15/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
          ev('17/09/2026', '11:00', 'Diseño aprobado', 'Laura Gómez'),
          ev('24/09/2026', '16:00', 'Despacho realizado', 'Pedro Ramírez'),
          ev('26/09/2026', '10:30', 'Pedido entregado al cliente', 'Pedro Ramírez'),
        ],
      },
      {
        n: 10, clienteId: 'C8', producto: 'Menús plastificados', cantidad: 40, material: 'Papel couché plastificado', dimensiones: 'Carta',
        colores: 'Rojo y crema', acabados: 'Plastificado', fechaSolicitud: '24/09/2026', fechaEntrega: '05/10/2026',
        estado: 'Despacho', disenoEstado: 'Aprobado', responsable: 'Pedro Ramírez', presupuesto: 210000, metodoEntrega: 'Domicilio',
        requerimientos: '', observaciones: '',
        versiones: [ver(1, '26/09/2026', 'Aprobada')],
        historial: [
          ev('24/09/2026', '10:00', 'Solicitud creada', 'Ana Martínez'),
          ev('28/09/2026', '09:00', 'Diseño aprobado', 'Camilo Peña'),
          ev('02/10/2026', '15:00', 'Acabados finalizados', 'Pedro Ramírez'),
        ],
      },
      {
        n: 11, clienteId: 'C2', producto: 'Catálogo de productos', cantidad: 60, material: 'Papel couché', dimensiones: 'A4, 20 páginas',
        colores: 'Full color', acabados: 'Encuadernación grapada', fechaSolicitud: '10/09/2026', fechaEntrega: '28/09/2026',
        estado: 'Entrega', disenoEstado: 'Aprobado', responsable: 'Sofía Herrera', presupuesto: 780000, metodoEntrega: 'Domicilio',
        requerimientos: '', observaciones: '',
        versiones: [ver(1, '12/09/2026', 'Aprobada')],
        historial: [
          ev('10/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
          ev('15/09/2026', '10:00', 'Diseño aprobado', 'Mario Díaz'),
          ev('28/09/2026', '11:00', 'Pedido entregado al cliente', 'Pedro Ramírez'),
        ],
      },
      {
        n: 12, clienteId: 'C4', producto: 'Stickers promocionales', cantidad: 1000, material: 'Vinilo adhesivo', dimensiones: '5cm x 5cm',
        colores: 'Naranja', acabados: 'Corte troquelado', fechaSolicitud: '08/09/2026', fechaEntrega: '22/09/2026',
        estado: 'Postventa', disenoEstado: 'Aprobado', responsable: 'Sofía Herrera', presupuesto: 150000, metodoEntrega: 'Recoge en taller',
        requerimientos: '', observaciones: '',
        versiones: [ver(1, '10/09/2026', 'Aprobada')],
        historial: [
          ev('08/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
          ev('12/09/2026', '10:00', 'Diseño aprobado', 'Diego Castro'),
          ev('22/09/2026', '11:00', 'Pedido entregado al cliente', 'Pedro Ramírez'),
          ev('25/09/2026', '09:30', 'Caso de postventa registrado', 'Sofía Herrera'),
        ],
      },
    ];

    const orderDbIdByCode = {};
    for (const o of ordenesIniciales) {
      const codigo = `OP-2026-${String(o.n).padStart(4, '0')}`;
      const solCodigo = `SOL-2026-${String(o.n).padStart(4, '0')}`;
      const cMeta = cMetaByCode[o.clienteId];
      const etapaNum = ETAPA_NUM_BY_ESTADO[o.estado] ?? 1;
      const pct = parseFloat(((etapaNum / 8) * 100).toFixed(2));
      const entregaJson = {
        direccion: `${cMeta.direccion}, ${cMeta.ciudad}`,
        metodo: o.metodoEntrega,
        contacto: cMeta.contacto,
      };
      const prodUserId = o.responsable === 'Juan Pérez' ? prodJuan : o.responsable === 'Pedro Ramírez' ? prodPedro : null;

      const existRes = await client.query('SELECT id FROM ordenes WHERE codigo = $1', [codigo]);
      let orderDbId;
      if (existRes.rowCount > 0) {
        orderDbId = existRes.rows[0].id;
      } else {
        const ins = await client.query(`
          INSERT INTO ordenes (
            codigo, solicitud_codigo, cliente_id, producto, ejecutiva_id, disenador_id, produccion_id,
            etapa, prioridad, porcentaje_avance, bloqueado,
            cantidad, material, dimensiones, colores, acabados,
            fecha_solicitud, fecha_entrega, estado_nombre, diseno_estado,
            responsable_nombre, disenador_nombre_asignado,
            presupuesto, costo_interno, metodo_entrega, requerimientos, observaciones, entrega_json
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,'Media',$9,false,
            $10,$11,$12,$13,$14,
            $15,$16,$17,$18,
            $19,'María López',
            $20,$21,$22,$23,$24,$25
          ) RETURNING id
        `, [
          codigo, solCodigo, cByCode[o.clienteId], o.producto, ejecutivaDefault, disenadoraDefault, prodUserId,
          etapaNum, pct,
          o.cantidad, o.material, o.dimensiones, o.colores, o.acabados,
          o.fechaSolicitud, o.fechaEntrega, o.estado, o.disenoEstado,
          o.responsable,
          o.presupuesto, Math.round(o.presupuesto * 0.6), o.metodoEntrega, o.requerimientos || '', o.observaciones || '', JSON.stringify(entregaJson),
        ]);
        orderDbId = ins.rows[0].id;

        // Insertar versiones de arte de esta orden
        for (const v of o.versiones) {
          const estadoDb = ESTADO_ARTE_DB[v.estado] || 'pendiente';
          await client.query(`
            INSERT INTO archivos_arte (
              orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion,
              decision_por, comentario, fecha_texto, disenador_nombre, estado_ui, archivo_nombre
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (orden_id, numero_version) DO NOTHING
          `, [
            orderDbId, v.numero, `uploads/Arte_Final_${codigo}_v${v.numero}.pdf`, disenadoraDefault, estadoDb,
            estadoDb === 'aprobado' || estadoDb === 'rechazado' ? coordDefault : null,
            v.comentario || null, v.fecha, v.disenador, v.estado, `Arte_Final_${codigo}_v${v.numero}.pdf`,
          ]);
        }

        // Insertar historial de sesión inmutable de esta orden
        for (const h of o.historial) {
          const respId = uByName[h.responsable] || coordDefault;
          await client.query(`
            INSERT INTO registro_sesion (
              orden_id, usuario_responsable_id, accion_texto,
              fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [
            orderDbId, respId, h.actividad,
            h.fecha, h.hora, h.responsable, h.estado || 'Completado', Boolean(h.interno),
          ]);
        }
      }
      orderDbIdByCode[codigo] = orderDbId;
    }
    console.log(`    ✅ ${ordenesIniciales.length} órdenes de producción y sus historiales verificados.`);

    // Sync序列 ordenes_id_seq
    await client.query(`SELECT setval(pg_get_serial_sequence('ordenes', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM ordenes), 1))`);

    // 4. Solicitudes (SOL-2026-0001 .. SOL-2026-0017)
    const solicitudesExtra = [
      { id: 'SOL-2026-0013', clienteId: 'C3', producto: 'Banner roll-up', cantidad: 2, dimensiones: '85cm x 200cm', material: 'Lona y estructura', fechaEntrega: '22/10/2026', presupuesto: 300000, requerimientos: 'Incluir código QR del menú.', observaciones: '', fechaSolicitud: '03/10/2026', estado: 'Pendiente', ordenId: null, motivoRechazo: '' },
      { id: 'SOL-2026-0014', clienteId: 'C5', producto: 'Etiquetas adhesivas', cantidad: 2000, dimensiones: '4cm x 3cm', material: 'Papel adhesivo', fechaEntrega: '24/10/2026', presupuesto: 180000, requerimientos: '', observaciones: '', fechaSolicitud: '03/10/2026', estado: 'Pendiente', ordenId: null, motivoRechazo: '' },
      { id: 'SOL-2026-0015', clienteId: 'C6', producto: 'Pendones de obra', cantidad: 6, dimensiones: '1m x 2m', material: 'Lona', fechaEntrega: '23/10/2026', presupuesto: 420000, requerimientos: 'Incluir normas de seguridad.', observaciones: '', fechaSolicitud: '02/10/2026', estado: 'En validación', ordenId: null, motivoRechazo: '' },
      { id: 'SOL-2026-0016', clienteId: 'C8', producto: 'Bolsas de papel impresas', cantidad: 500, dimensiones: '25cm x 30cm', material: 'Papel kraft', fechaEntrega: '25/10/2026', presupuesto: 390000, requerimientos: 'Logo a una tinta.', observaciones: '', fechaSolicitud: '02/10/2026', estado: 'En validación', ordenId: null, motivoRechazo: '' },
      { id: 'SOL-2026-0017', clienteId: 'C7', producto: 'Carnés estudiantiles', cantidad: 10, dimensiones: '8.5cm x 5.4cm', material: 'PVC', fechaEntrega: '15/10/2026', presupuesto: 50000, requerimientos: '', observaciones: '', fechaSolicitud: '01/10/2026', estado: 'Rechazada', ordenId: null, motivoRechazo: 'La cantidad es inferior al mínimo de producción (50 unidades).' },
    ];

    const todasSolicitudes = [
      ...ordenesIniciales.map((o) => ({
        id: `SOL-2026-${String(o.n).padStart(4, '0')}`,
        clienteId: o.clienteId,
        producto: o.producto,
        cantidad: o.cantidad,
        dimensiones: o.dimensiones,
        material: o.material,
        fechaEntrega: o.fechaEntrega,
        presupuesto: o.presupuesto,
        requerimientos: o.requerimientos || '',
        observaciones: o.observaciones || '',
        fechaSolicitud: o.fechaSolicitud,
        estado: 'Aprobada',
        ordenId: `OP-2026-${String(o.n).padStart(4, '0')}`,
        motivoRechazo: '',
      })),
      ...solicitudesExtra,
    ];

    for (const s of todasSolicitudes) {
      const estadoDb = ESTADO_SOL_DB[s.estado] || 'pendiente';
      const ordId = s.ordenId ? orderDbIdByCode[s.ordenId] : null;
      await client.query(`
        INSERT INTO solicitudes (
          codigo, cliente_id, ejecutiva_id, descripcion, estado,
          producto, cantidad, dimensiones, material, fecha_solicitud, fecha_entrega,
          presupuesto, requerimientos, observaciones, motivo_rechazo, orden_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (codigo) DO NOTHING
      `, [
        s.id, cByCode[s.clienteId], ejecutivaDefault, `${s.producto} (${s.cantidad} uds)`, estadoDb,
        s.producto, s.cantidad, s.dimensiones, s.material, s.fechaSolicitud, s.fechaEntrega,
        s.presupuesto, s.requerimientos, s.observaciones, s.motivoRechazo, ordId,
      ]);
    }
    console.log(`    ✅ ${todasSolicitudes.length} solicitudes comerciales verificadas.`);

    // 5. Tareas de taller (T-001 .. T-007)
    const tareasIniciales = [
      { id: 'T-001', ordenId: 'OP-2026-0001', actividad: 'Impresión de pendones', etapa: 'Impresión', responsable: 'Juan Pérez', prioridad: 'Alta', fechaLimite: '08/10/2026', estado: 'En proceso', pct: 65, deps: [] },
      { id: 'T-002', ordenId: 'OP-2026-0001', actividad: 'Corte y ojales', etapa: 'Acabados', responsable: 'Juan Pérez', prioridad: 'Media', fechaLimite: '09/10/2026', estado: 'Pendiente', pct: 0, deps: ['T-001'] },
      { id: 'T-003', ordenId: 'OP-2026-0005', actividad: 'Impresión de plegables', etapa: 'Impresión', responsable: 'Juan Pérez', prioridad: 'Alta', fechaLimite: '02/10/2026', estado: 'En proceso', pct: 40, deps: [] },
      { id: 'T-004', ordenId: 'OP-2026-0006', actividad: 'Laminado de cajas', etapa: 'Acabados', responsable: 'Pedro Ramírez', prioridad: 'Alta', fechaLimite: '01/10/2026', estado: 'En proceso', pct: 50, deps: [] },
      { id: 'T-005', ordenId: 'OP-2026-0008', actividad: 'Encuadernación de agendas', etapa: 'Acabados', responsable: 'Pedro Ramírez', prioridad: 'Media', fechaLimite: '06/10/2026', estado: 'Pendiente', pct: 0, deps: [] },
      { id: 'T-006', ordenId: 'OP-2026-0010', actividad: 'Despacho de menús', etapa: 'Despacho', responsable: 'Pedro Ramírez', prioridad: 'Media', fechaLimite: '05/10/2026', estado: 'Pendiente', pct: 0, deps: [] },
      { id: 'T-007', ordenId: 'OP-2026-0006', actividad: 'Corte de cajas', etapa: 'Acabados', responsable: 'Juan Pérez', prioridad: 'Media', fechaLimite: '30/09/2026', estado: 'Finalizada', pct: 100, deps: [] },
    ];

    for (const t of tareasIniciales) {
      const ordId = orderDbIdByCode[t.ordenId];
      const ownerId = uByName[t.responsable] || prodJuan;
      await client.query(`
        INSERT INTO tareas (
          codigo, orden_id, owner_id, titulo, porcentaje, dependencias,
          etapa, responsable_nombre, prioridad, fecha_limite, estado, notas, incidencias
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'[]'::jsonb,'[]'::jsonb)
        ON CONFLICT (codigo) DO NOTHING
      `, [
        t.id, ordId, ownerId, t.actividad, t.pct, JSON.stringify(t.deps),
        t.etapa, t.responsable, t.prioridad, t.fechaLimite, t.estado,
      ]);
    }
    console.log(`    ✅ ${tareasIniciales.length} tareas de taller verificadas.`);

    // 6. Casos de postventa (PV-001 .. PV-008)
    const casosIniciales = [
      { id: 'PV-001', ordenId: 'OP-2026-0009', tipo: 'Garantía', fecha: '28/09/2026', descripcion: 'Consulta por la garantía de 6 meses sobre la impresión.', responsable: 'Sofía Herrera', estado: 'Resuelto', solucion: 'Se confirmó la garantía por escrito.', calificacion: 5 },
      { id: 'PV-002', ordenId: 'OP-2026-0009', tipo: 'Comentario', fecha: '29/09/2026', descripcion: 'Excelente calidad y entrega puntual.', responsable: 'Sofía Herrera', estado: 'Resuelto', solucion: 'Comentario registrado.', calificacion: 5 },
      { id: 'PV-003', ordenId: 'OP-2026-0009', tipo: 'Ajuste', fecha: '30/09/2026', descripcion: 'Cambiar el cargo en una de las tarjetas.', responsable: 'Sofía Herrera', estado: 'Resuelto', solucion: 'Se reimprimieron 25 tarjetas sin costo.', calificacion: 4 },
      { id: 'PV-004', ordenId: 'OP-2026-0011', tipo: 'Reclamo', fecha: '01/10/2026', descripcion: 'Dos catálogos llegaron con páginas mal engrapadas.', responsable: '', estado: 'Abierto', solucion: '', calificacion: null },
      { id: 'PV-005', ordenId: 'OP-2026-0011', tipo: 'Reimpresión', fecha: '02/10/2026', descripcion: 'Solicitan reimprimir 10 catálogos con la portada corregida.', responsable: 'Sofía Herrera', estado: 'En trámite', solucion: '', calificacion: null },
      { id: 'PV-006', ordenId: 'OP-2026-0012', tipo: 'Reclamo', fecha: '25/09/2026', descripcion: 'El color naranja se ve más oscuro de lo esperado.', responsable: '', estado: 'Abierto', solucion: '', calificacion: null },
      { id: 'PV-007', ordenId: 'OP-2026-0012', tipo: 'Ajuste', fecha: '27/09/2026', descripcion: 'Solicitan cortar los stickers con esquinas redondeadas.', responsable: 'Sofía Herrera', estado: 'En trámite', solucion: '', calificacion: null },
      { id: 'PV-008', ordenId: 'OP-2026-0012', tipo: 'Garantía', fecha: '29/09/2026', descripcion: 'Garantía por adhesivo que se despega.', responsable: 'Sofía Herrera', estado: 'Resuelto', solucion: 'Se enviaron 100 stickers de reposición.', calificacion: 4 },
    ];

    for (const c of casosIniciales) {
      const ordId = orderDbIdByCode[c.ordenId];
      await client.query(`
        INSERT INTO postventa (
          codigo, orden_id, ejecutiva_id, tipo, nivel_conformidad, descripcion,
          fecha_texto, responsable_nombre, estado, prioridad, solucion
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Media',$10)
        ON CONFLICT (codigo) DO NOTHING
      `, [
        c.id, ordId, ejecutivaDefault, c.tipo, c.calificacion, c.descripcion,
        c.fecha, c.responsable, c.estado, c.solucion,
      ]);
    }
    console.log(`    ✅ ${casosIniciales.length} casos de postventa verificados.`);

    // 7. Comunicaciones multicanal (COM-001 .. COM-008)
    const commsIniciales = [
      {
        id: 'COM-001', canal: 'wa', clienteId: 'C1', ordenId: 'OP-2026-0003', responsable: 'Ana Martínez',
        estado: 'Pendiente de respuesta', asunto: 'Ajuste en versión 2 de vinilo para vitrina',
        mensajes: [
          { de: 'usuario', texto: 'Laura, te compartimos la versión 2 del vinilo para tu aprobación.', fecha: '02/10/2026', hora: '16:20' },
          { de: 'cliente', texto: 'Hola Ana, nos gustó mucho, pero necesitamos confirmar si pueden instalarlo el viernes temprano.', fecha: '03/10/2026', hora: '08:50' },
        ],
      },
      {
        id: 'COM-002', canal: 'mail', clienteId: 'C1', ordenId: 'OP-2026-0001', responsable: 'Ana Martínez',
        estado: 'Cerrada', asunto: 'Cotización aprobada: 5 pendones publicitarios',
        mensajes: [
          { de: 'usuario', texto: 'Adjuntamos la cotización de los 5 pendones publicitarios (2m x 1m, lona con refuerzo).', fecha: '28/09/2026', hora: '10:00', adjuntos: ['Cotizacion_OP-0001.pdf'] },
          { de: 'cliente', texto: 'Cotización aprobada formalmente. Procedan con el diseño.', fecha: '28/09/2026', hora: '14:20' },
        ],
      },
      {
        id: 'COM-003', canal: 'call', clienteId: 'C1', ordenId: 'OP-2026-0001', responsable: 'Ana Martínez',
        estado: 'Cerrada', asunto: 'Llamada de recepción y especificaciones',
        mensajes: [
          { de: 'cliente', texto: 'Llamada entrante (6:15 min). La cliente Laura Gómez detalla los colores corporativos y solicita entrega el 10/10.', fecha: '28/09/2026', hora: '09:10', llamadaMinutos: '6:15' },
        ],
      },
      {
        id: 'COM-004', canal: 'wa', clienteId: 'C2', ordenId: 'OP-2026-0002', responsable: 'Ana Martínez',
        estado: 'Respondida', asunto: 'Avance de diseño papelería',
        mensajes: [
          { de: 'cliente', texto: 'Mario Díaz: ¿para cuándo tendríamos el boceto de las hojas membretadas?', fecha: '02/10/2026', hora: '11:00' },
          { de: 'usuario', texto: 'Hola Mario, la diseñadora María López lo tendrá listo hoy al final de la tarde.', fecha: '02/10/2026', hora: '11:25' },
        ],
      },
      {
        id: 'COM-005', canal: 'mail', clienteId: 'C3', ordenId: 'OP-2026-0004', responsable: 'Ana Martínez',
        estado: 'Pendiente de respuesta', asunto: 'Observaciones de diseño en volantes',
        mensajes: [
          { de: 'cliente', texto: 'Revisamos la propuesta pero el logo se ve muy pequeño. Por favor aumentarlo un 25% y centrar los teléfonos.', fecha: '02/10/2026', hora: '08:50' },
        ],
      },
      {
        id: 'COM-006', canal: 'call', clienteId: 'C5', ordenId: 'OP-2026-0007', responsable: 'Ana Martínez',
        estado: 'Respondida', asunto: 'Confirmación de medidas de etiquetas',
        mensajes: [
          { de: 'cliente', texto: 'Llamada saliente (3:40 min). Se acordó que las etiquetas circulares serán de 6cm de diámetro.', fecha: '26/09/2026', hora: '15:10', llamadaMinutos: '3:40' },
        ],
      },
      {
        id: 'COM-007', canal: 'wa', clienteId: 'C6', ordenId: 'OP-2026-0005', responsable: 'Carlos Ruiz',
        estado: 'Abierta', asunto: 'Insumo de papel para plegables de obra',
        mensajes: [
          { de: 'cliente', texto: 'Felipe: ¿cómo va la producción de los 1.000 plegables? Los requerimos para el lanzamiento.', fecha: '03/10/2026', hora: '09:15' },
          { de: 'usuario', texto: 'Estamos en proceso de impresión, el proveedor nos despacha el papel faltante para completar el lote.', fecha: '03/10/2026', hora: '09:30' },
        ],
      },
      {
        id: 'COM-008', canal: 'mail', clienteId: 'C8', ordenId: 'OP-2026-0010', responsable: 'Pedro Ramírez',
        estado: 'Cerrada', asunto: 'Despacho de menús plastificados',
        mensajes: [
          { de: 'usuario', texto: 'Camilo, tus menús plastificados están listos y salen hoy a despacho con nuestro mensajero.', fecha: '03/10/2026', hora: '07:45' },
          { de: 'cliente', texto: 'Excelente noticia, estaremos atentos para recibirlos. Gracias.', fecha: '03/10/2026', hora: '08:10' },
        ],
      },
    ];

    for (const cm of commsIniciales) {
      const exist = await client.query('SELECT id FROM canales_contacto WHERE codigo = $1', [cm.id]);
      if (exist.rowCount === 0) {
        const respId = uByName[cm.responsable] || ejecutivaDefault;
        const ordId = cm.ordenId ? orderDbIdByCode[cm.ordenId] : null;
        const cIns = await client.query(`
          INSERT INTO canales_contacto (
            codigo, canal, cliente_id, orden_id, usuario_responsable_id,
            responsable_nombre, estado, asunto
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING id
        `, [cm.id, cm.canal, cByCode[cm.clienteId], ordId, respId, cm.responsable, cm.estado, cm.asunto]);
        const canalUuid = cIns.rows[0].id;

        for (const m of cm.mensajes) {
          await client.query(`
            INSERT INTO mensajes_entrantes (
              canal_id, remitente, texto, de, fecha_texto, hora_texto, adjuntos, duracion
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [
            canalUuid,
            m.de === 'usuario' ? cm.responsable : cMetaByCode[cm.clienteId].contacto,
            m.texto,
            m.de,
            m.fecha,
            m.hora,
            m.adjuntos ? JSON.stringify(m.adjuntos) : null,
            m.llamadaMinutos || null,
          ]);
        }
      }
    }
    console.log(`    ✅ ${commsIniciales.length} hilos de comunicación multicanal verificados.`);

    // 8. Materiales de inventario iniciales (si no existen)
    const materiales = [
      ['Lona Banner 13oz', 500, 50],
      ['Vinilo Adhesivo Brillante', 350, 40],
      ['Papel Propalcote 150g', 5000, 500],
      ['Cartulina Maule 300g', 2000, 200],
    ];
    for (const [nom, actual, min] of materiales) {
      await client.query(`
        INSERT INTO inventario (nombre_material, stock_actual, stock_minimo)
        VALUES ($1, $2, $3)
        ON CONFLICT (nombre_material) DO NOTHING
      `, [nom, actual, min]);
    }

    await client.query('COMMIT');
    console.log('\n🎉  [Seed Seguro] Base de datos lista sin pérdida de información.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌  Error durante el Seed Seguro:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSafeSeed();
}

module.exports = { runSafeSeed };
