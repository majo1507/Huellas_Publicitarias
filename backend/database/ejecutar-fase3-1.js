// ============================================================
// backend/database/ejecutar-fase3-1.js
// Ejecución de la Fase 3.1: Aseguramiento de Datos Maestros y Catálogos
// ============================================================
const { pool } = require('../db');

async function ejecutarFase3_1() {
  const client = await pool.connect();

  try {
    console.log('============================================================');
    console.log('🚀 [FASE 3.1] INICIANDO EJECUCIÓN AUTORIZADA DE DATOS MAESTROS');
    console.log('============================================================\n');

    await client.query('BEGIN');

    // ------------------------------------------------------------
    // PASO 1: Comprobar identificadores y nombres de materiales en inventario
    // ------------------------------------------------------------
    console.log('📌 PASO 1: Verificando materiales existentes en public.inventario...');
    const resInvPrevio = await client.query(`
      SELECT id, codigo, nombre_material, stock_actual, stock_reservado, unidad, proveedor_codigo, proveedor_nombre
      FROM inventario
      ORDER BY id ASC
    `);

    console.log(`   Se encontraron ${resInvPrevio.rowCount} materiales registrados en inventario:`);
    resInvPrevio.rows.forEach(m => {
      console.log(`   - ID ${m.id} | Código: "${m.codigo}" | Nombre: "${m.nombre_material}" | Stock: ${m.stock_actual} ${m.unidad} | Proveedor actual: [${m.proveedor_codigo || 'vacío'}] "${m.proveedor_nombre || 'vacío'}"`);
    });

    // Validar coincidencia estricta de los 4 materiales esperados
    const esperados = {
      1: 'Lona Banner 13oz',
      2: 'Vinilo Adhesivo Brillante',
      3: 'Papel Propalcote 150g',
      4: 'Cartulina Maule 300g'
    };

    for (const [idStr, nombreEsperado] of Object.entries(esperados)) {
      const mat = resInvPrevio.rows.find(r => r.id === parseInt(idStr, 10));
      if (!mat) {
        throw new Error(`Inconsistencia: No se encontró el material con ID ${idStr} en la tabla inventario.`);
      }
      if (mat.nombre_material !== nombreEsperado) {
        throw new Error(`Inconsistencia: El material ID ${idStr} tiene nombre "${mat.nombre_material}", se esperaba "${nombreEsperado}".`);
      }
      const provValidoParaActualizar = !mat.proveedor_codigo || mat.proveedor_codigo.trim() === '' ||
        !mat.proveedor_nombre || mat.proveedor_nombre.trim() === '' || mat.proveedor_nombre.trim().toLowerCase() === 'por definir';
      if (!provValidoParaActualizar) {
        console.warn(`   ⚠️ Advertencia: Material ID ${idStr} ya posee un proveedor asignado diferente de "Por definir": "${mat.proveedor_nombre}".`);
      }
    }
    console.log('   ✅ Verificación de materiales existentes superada con éxito.\n');

    // ------------------------------------------------------------
    // PASO 2: Inserción de proveedores con ON CONFLICT (codigo) DO NOTHING
    // ------------------------------------------------------------
    console.log('📌 PASO 2: Insertando proveedores en public.proveedores...');

    const proveedoresAInsertar = [
      {
        codigo: 'PROV-001',
        nombre: 'Suministros Gráficos Andinos S.A.S.',
        tipo_documento: 'NIT',
        nit: '900.310.440-1',
        contacto: 'Héctor Salcedo',
        telefono: '310 540 8812',
        correo: 'ventas@graficosandinos.co',
        ciudad: 'Bogotá',
        departamento: 'Bogotá D.C.',
        municipio: 'Bogotá',
        pais: 'Colombia',
        productos: JSON.stringify(['Lona banner 13 oz', 'Lona mate', 'Vinilo adhesivo brillante']),
        estado: 'Activo'
      },
      {
        codigo: 'PROV-002',
        nombre: 'Papelera Nacional del Centro',
        tipo_documento: 'NIT',
        nit: '890.901.112-4',
        contacto: 'Marcela Quintero',
        telefono: '315 782 1940',
        correo: 'pedidos@papeleranacional.co',
        ciudad: 'Medellín',
        departamento: 'Antioquia',
        municipio: 'Medellín',
        pais: 'Colombia',
        productos: JSON.stringify(['Papel propalcote 150g', 'Papel propalcote 300g', 'Papel bond 90g']),
        estado: 'Activo'
      },
      {
        codigo: 'PROV-003',
        nombre: 'Tintas & Polímeros UV Colombia',
        tipo_documento: 'NIT',
        nit: '901.044.892-7',
        contacto: 'Ricardo Montoya',
        telefono: '318 334 9021',
        correo: 'comercial@tintasuv.co',
        ciudad: 'Bogotá',
        departamento: 'Bogotá D.C.',
        municipio: 'Bogotá',
        pais: 'Colombia',
        productos: JSON.stringify(['Laminado mate protector', 'Laminado brillante UV']),
        estado: 'Activo'
      },
      {
        codigo: 'PROV-004',
        nombre: 'Estructuras y Acrílicos Industriales',
        tipo_documento: 'NIT',
        nit: '800.519.220-5',
        contacto: 'Claudia Pineda',
        telefono: '320 611 4500',
        correo: 'logistica@estructurasacrilicos.co',
        ciudad: 'Cali',
        departamento: 'Valle del Cauca',
        municipio: 'Cali',
        pais: 'Colombia',
        productos: JSON.stringify(['Acrílico cristal 3mm', 'Lona y estructura Roll-Up']),
        estado: 'Activo'
      }
    ];

    const insertados = [];
    const omitidos = [];

    for (const p of proveedoresAInsertar) {
      const q = `
        INSERT INTO proveedores (
          codigo, nombre, tipo_documento, nit, contacto, telefono, correo,
          ciudad, departamento, municipio, pais, productos, estado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
        ON CONFLICT (codigo) DO NOTHING
        RETURNING *;
      `;
      const valores = [
        p.codigo, p.nombre, p.tipo_documento, p.nit, p.contacto, p.telefono, p.correo,
        p.ciudad, p.departamento, p.municipio, p.pais, p.productos, p.estado
      ];

      const resInsert = await client.query(q, valores);
      if (resInsert.rowCount > 0) {
        insertados.push(resInsert.rows[0]);
        console.log(`   ✅ Insertado: ${p.codigo} - ${p.nombre}`);
      } else {
        omitidos.push(p);
        console.log(`   ℹ️ Omitido por conflicto preexistente (ON CONFLICT): ${p.codigo} - ${p.nombre}`);
      }
    }

    // ------------------------------------------------------------
    // PASO 3: Vincular materiales con proveedores en public.inventario
    // ------------------------------------------------------------
    console.log('\n📌 PASO 3: Vinculando materiales existentes con proveedores en public.inventario...');

    // Materiales 1 y 2 -> PROV-001 (Suministros Gráficos Andinos S.A.S.)
    const up1 = await client.query(`
      UPDATE inventario
      SET proveedor_codigo = 'PROV-001',
          proveedor_nombre = 'Suministros Gráficos Andinos S.A.S.'
      WHERE id IN (1, 2)
        AND nombre_material IN ('Lona Banner 13oz', 'Vinilo Adhesivo Brillante')
        AND (proveedor_codigo IS NULL OR proveedor_codigo = '' OR proveedor_nombre IS NULL OR proveedor_nombre = '' OR proveedor_nombre = 'Por definir')
      RETURNING id, codigo, nombre_material, proveedor_codigo, proveedor_nombre;
    `);
    console.log(`   - Insumos 1 y 2 actualizados (${up1.rowCount} filas):`);
    up1.rows.forEach(r => console.log(`     * ID ${r.id} (${r.nombre_material}) -> ${r.proveedor_codigo} (${r.proveedor_nombre})`));

    // Material 3 -> PROV-002 (Papelera Nacional del Centro)
    const up2 = await client.query(`
      UPDATE inventario
      SET proveedor_codigo = 'PROV-002',
          proveedor_nombre = 'Papelera Nacional del Centro'
      WHERE id = 3
        AND nombre_material = 'Papel Propalcote 150g'
        AND (proveedor_codigo IS NULL OR proveedor_codigo = '' OR proveedor_nombre IS NULL OR proveedor_nombre = '' OR proveedor_nombre = 'Por definir')
      RETURNING id, codigo, nombre_material, proveedor_codigo, proveedor_nombre;
    `);
    console.log(`   - Insumo 3 actualizado (${up2.rowCount} filas):`);
    up2.rows.forEach(r => console.log(`     * ID ${r.id} (${r.nombre_material}) -> ${r.proveedor_codigo} (${r.proveedor_nombre})`));

    // Material 4 -> PROV-004 (Estructuras y Acrílicos Industriales)
    const up3 = await client.query(`
      UPDATE inventario
      SET proveedor_codigo = 'PROV-004',
          proveedor_nombre = 'Estructuras y Acrílicos Industriales'
      WHERE id = 4
        AND nombre_material = 'Cartulina Maule 300g'
        AND (proveedor_codigo IS NULL OR proveedor_codigo = '' OR proveedor_nombre IS NULL OR proveedor_nombre = '' OR proveedor_nombre = 'Por definir')
      RETURNING id, codigo, nombre_material, proveedor_codigo, proveedor_nombre;
    `);
    console.log(`   - Insumo 4 actualizado (${up3.rowCount} filas):`);
    up3.rows.forEach(r => console.log(`     * ID ${r.id} (${r.nombre_material}) -> ${r.proveedor_codigo} (${r.proveedor_nombre})`));

    await client.query('COMMIT');
    console.log('\n✅ Transacción completada y confirmada (COMMIT).');

    // ------------------------------------------------------------
    // PASO 4: Consultas de verificación final
    // ------------------------------------------------------------
    console.log('\n============================================================');
    console.log('🔍 PASO 4: CONSULTAS DE VERIFICACIÓN EN POSTGRESQL');
    console.log('============================================================');

    const resProvFinal = await client.query(`
      SELECT id, codigo, nombre, nit, contacto, telefono, correo, ciudad, estado, productos
      FROM proveedores
      ORDER BY id ASC;
    `);
    console.log(`\n📋 Proveedores en public.proveedores (${resProvFinal.rowCount} filas):`);
    console.table(resProvFinal.rows.map(r => ({
      ID: r.id,
      Código: r.codigo,
      Nombre: r.nombre,
      NIT: r.nit,
      Contacto: r.contacto,
      Teléfono: r.telefono,
      Ciudad: r.ciudad,
      Estado: r.estado
    })));

    const resInvFinal = await client.query(`
      SELECT id, codigo, nombre_material, stock_actual, stock_reservado, unidad, proveedor_codigo, proveedor_nombre
      FROM inventario
      ORDER BY id ASC;
    `);
    console.log(`\n📦 Materiales en public.inventario (${resInvFinal.rowCount} filas):`);
    console.table(resInvFinal.rows.map(r => ({
      ID: r.id,
      Código: r.codigo,
      Nombre: r.nombre_material,
      Stock: `${r.stock_actual} ${r.unidad} (Reservado: ${r.stock_reservado})`,
      'Cód. Proveedor': r.proveedor_codigo,
      'Nombre Proveedor': r.proveedor_nombre
    })));

    return {
      exito: true,
      insertados,
      omitidos,
      proveedoresTotales: resProvFinal.rows,
      inventarioFinal: resInvFinal.rows
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en ejecución de Fase 3.1:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  ejecutarFase3_1()
    .then(() => {
      console.log('🎉 Fase 3.1 finalizada satisfactoriamente.');
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { ejecutarFase3_1 };
