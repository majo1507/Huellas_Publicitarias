const bcrypt = require('bcryptjs');
const { pool } = require('../db');

async function seed() {
  if (process.env.ALLOW_DESTRUCTIVE_RESET !== 'true') {
    console.error('🛑  PROTECCIÓN ACTIVA: seed.js contiene TRUNCATE CASCADE.');
    console.error('    Usa "npm run seed:safe" para poblar datos de forma idempotente sin borrar información.');
    process.exit(1);
  }
  const client = await pool.connect();
  console.log('🌱  Iniciando proceso de poblamiento (Seed)...');

  try {
    await client.query('BEGIN');

    // 1. Limpiar datos existentes en cascada
    console.log('🧹  Limpiando tablas existentes...');
    await client.query('TRUNCATE TABLE postventa, archivos_arte, ordenes, clientes, usuarios RESTART IDENTITY CASCADE;');

    // 2. Insertar Usuarios con contraseña por defecto: "Huellas2026*"
    console.log('👤  Insertando personal de Huellas con contraseñas seguras...');
    const defaultPasswordHash = bcrypt.hashSync('Huellas2026*', 10);
    const usuariosSql = `
      INSERT INTO usuarios (nombre_completo, email, password_hash, rol, esta_activo)
      VALUES 
        ('Laura Gómez', 'laura.gomez@huellas.com', $1, 'ejecutiva', true),
        ('Carolina Rivas', 'carolina.rivas@huellas.com', $1, 'ejecutiva', true),
        ('Andrés Morales', 'andres.diseno@huellas.com', $1, 'disenador', true),
        ('Valentina López', 'valentina.diseno@huellas.com', $1, 'disenador', true),
        ('David Torres', 'david.coord@huellas.com', $1, 'coord', true),
        ('Mateo Herrera', 'mateo.prod@huellas.com', $1, 'produccion', true),
        ('Sofía Ramírez', 'sofia.gerencia@huellas.com', $1, 'gerente', true)
      RETURNING id, nombre_completo, email, rol;
    `;
    const usuariosRes = await client.query(usuariosSql, [defaultPasswordHash]);
    const uMap = {};
    usuariosRes.rows.forEach(u => {
      uMap[u.email] = u.id;
    });
    console.log(`    ✅ ${usuariosRes.rowCount} usuarios creados.`);

    // 3. Insertar Clientes
    console.log('🏢  Insertando clientes...');
    const clientesSql = `
      INSERT INTO clientes (empresa, nit, contacto_principal, telefono, correo, ejecutiva_id, estado)
      VALUES
        ('Bavaria S.A.', '860005224-6', 'Felipe Castro', '3104567890', 'felipe.castro@bavaria.co', $1, 'Activo'),
        ('Restaurante El Corral', '900142857-3', 'Patricia Mendoza', '3157891234', 'patricia@elcorral.com', $1, 'Activo'),
        ('Bancolombia S.A.', '890903938-8', 'Esteban Jaramillo', '3009876543', 'ejaramillo@bancolombia.com.co', $2, 'Activo'),
        ('Almacenes Éxito S.A.', '890900608-9', 'Claudia Osorio', '3201122334', 'cosorio@grupo-exito.com', $2, 'Nuevo'),
        ('Clínica Las Américas', '890980123-1', 'Dr. Roberto Vélez', '3189988776', 'rvelez@lasamericas.com.co', $1, 'En riesgo')
      RETURNING id, empresa;
    `;
    const clientesRes = await client.query(clientesSql, [
      uMap['laura.gomez@huellas.com'],
      uMap['carolina.rivas@huellas.com'],
    ]);
    const cMap = {};
    clientesRes.rows.forEach(c => {
      cMap[c.empresa] = c.id;
    });
    console.log(`    ✅ ${clientesRes.rowCount} clientes creados.`);

    // 4. Insertar Órdenes
    console.log('📦  Insertando órdenes de producción...');
    const ordenesSql = `
      INSERT INTO ordenes (cliente_id, producto, ejecutiva_id, disenador_id, produccion_id, etapa, prioridad, porcentaje_avance, bloqueado)
      VALUES
        ($1, 'Valla Publicitaria 12x4m Autopista Norte', $6, $8, $10, 5, 'Alta', 62.50, false),
        ($2, 'Cajas de Luz LED para Menú Principal', $6, $9, $10, 3, 'Media', 37.50, false),
        ($3, 'Branding e Impresión Gran Formato Sede Central', $7, $8, $10, 7, 'Alta', 87.50, false),
        ($4, 'Material POP y Rompetráficos Promocionales', $7, $8, null, 8, 'Media', 100.00, false),
        ($5, 'Señalética Acrílica y Vinilos de Seguridad', $6, $9, null, 1, 'Baja', 12.50, false)
      RETURNING id, producto, etapa, porcentaje_avance;
    `;
    const ordenesRes = await client.query(ordenesSql, [
      cMap['Bavaria S.A.'],
      cMap['Restaurante El Corral'],
      cMap['Bancolombia S.A.'],
      cMap['Almacenes Éxito S.A.'],
      cMap['Clínica Las Américas'],
      uMap['laura.gomez@huellas.com'],
      uMap['carolina.rivas@huellas.com'],
      uMap['andres.diseno@huellas.com'],
      uMap['valentina.diseno@huellas.com'],
      uMap['mateo.prod@huellas.com'],
    ]);
    console.log(`    ✅ ${ordenesRes.rowCount} órdenes de producción creadas.`);

    // 5. Insertar Archivos de Arte
    console.log('🎨  Insertando versiones de arte...');
    const arteSql = `
      INSERT INTO archivos_arte (orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion, decision_por, comentario)
      VALUES
        ($1, 1, 'uploads/orden_1_v1.pdf', $3, 'rechazado', $4, 'Aumentar contraste y legibilidad del logotipo'),
        ($1, 2, 'uploads/orden_1_v2.pdf', $3, 'aprobado', $4, 'Aprobado formalmente por el cliente'),
        ($2, 1, 'uploads/orden_2_v1.pdf', $5, 'pendiente', null, 'Primera propuesta de diagramación en espera de revisión')
      RETURNING id;
    `;
    const arteRes = await client.query(arteSql, [
      ordenesRes.rows[0].id,
      ordenesRes.rows[1].id,
      uMap['andres.diseno@huellas.com'],
      uMap['laura.gomez@huellas.com'],
      uMap['valentina.diseno@huellas.com'],
    ]);
    console.log(`    ✅ ${arteRes.rowCount} archivos de arte registrados.`);

    // 6. Insertar Postventa
    console.log('⭐  Insertando registros de postventa...');
    const pvSql = `
      INSERT INTO postventa (orden_id, ejecutiva_id, tipo, nivel_conformidad, descripcion)
      VALUES
        ($1, $3, 'Comentario', 5, 'Cliente muy satisfecho con la nitidez de colores y la entrega a tiempo.'),
        ($2, $4, 'Ajuste', 4, 'Se acordó pequeño reajuste en los perfiles de montaje de la estructura.')
      RETURNING id;
    `;
    const pvRes = await client.query(pvSql, [
      ordenesRes.rows[3].id, // orden 4 (Éxito, terminada)
      ordenesRes.rows[2].id, // orden 3 (Bancolombia)
      uMap['carolina.rivas@huellas.com'],
      uMap['carolina.rivas@huellas.com'],
    ]);
    console.log(`    ✅ ${pvRes.rowCount} registros de postventa añadidos.`);

    await client.query('COMMIT');
    console.log('\n🎉  ¡Base de datos poblada exitosamente con datos de prueba!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌  Error durante el Seed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
