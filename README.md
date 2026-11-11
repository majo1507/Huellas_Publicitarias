# ORVEX — Huellas Publicidad

Sistema de gestión y seguimiento de órdenes de producción gráfica para Huellas Publicidad.

ORVEX conecta en un solo sistema el flujo **Recepción → Diseño → Aprobación de diseño → Impresión → Acabados → Despacho → Entrega → Postventa / Cierre**, con seis roles internos, persistencia en PostgreSQL y trazabilidad de quién hizo qué, cuándo y en qué estado quedó cada orden.

---

## 1. Arquitectura

| Capa | Tecnología | Ubicación |
|---|---|---|
| Frontend | React 18 + Vite 5 | [`src/`](./src/) — punto de entrada [`App.jsx`](./src/App.jsx), cliente API [`services/api.js`](./src/services/api.js) |
| Backend | Node.js + Express 4, API REST | [`backend/`](./backend/) — [`index.js`](./backend/index.js), `routes/`, `controllers/`, `middleware/` |
| Base de datos | PostgreSQL (probado con 18) | [`backend/database/`](./backend/database/) — `schema.sql`, `migrations/` |
| Seguridad | JWT (`jsonwebtoken`) + bcrypt, autorización por rol en cada ruta | [`backend/middleware/auth.js`](./backend/middleware/auth.js) |
| Archivos | `multer`, almacenados en `backend/uploads/` y servidos en `/uploads` | `backend/utils/validacionesArchivo.js` |
| Documentación API | Swagger UI | `http://localhost:3000/api/docs` |

Estilos: [`src/index.css`](./src/index.css) (base) y [`src/theme.css`](./src/theme.css). La identidad vigente es la capa **ORVEX — Futuristic Enterprise** de `theme.css` y la capa final **Refinamiento final** al cierre del mismo archivo.

## 2. Requisitos

- Node.js 18 o superior (probado con Node 24) y npm.
- PostgreSQL 14 o superior en ejecución local (probado con PostgreSQL 18).

## 3. Variables de entorno

**Backend** — copia `backend/.env.example` como `backend/.env` y completa los valores:

| Variable | Uso |
|---|---|
| `PORT` | Puerto del API (por defecto `3000`) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL |
| `DB_MAX_CONNECTIONS`, `DB_IDLE_TIMEOUT`, `DB_CONNECTION_TIMEOUT` | Ajustes del pool |
| `JWT_SECRET` | Secreto para firmar tokens (cadena aleatoria de 32+ caracteres) |
| `JWT_EXPIRES_IN` | Vigencia del token (por defecto `24h`) |

Una variable definida en la terminal tiene prioridad sobre `backend/.env` (por ejemplo `DB_NAME=orvex_qa`).

**Frontend** — `.env` en la raíz (ver `.env.example`):

| Variable | Uso |
|---|---|
| `VITE_API_URL` | URL del API, por defecto `http://localhost:3000/api` |
| `VITE_USE_MOCK` | `true` fuerza el modo demostración sin servidor. Para la presentación: `false` |

## 4. Base de datos

### 4.1 Base nueva (instalación desde cero)

Este procedimiento se verificó completo sobre una base vacía. **`schema.sql` borra y recrea tablas: úsalo solo en una base nueva y vacía.**

```bash
createdb -U postgres orvex_demo
```

```bash
cd backend
```

PowerShell:

```powershell
$env:DB_NAME='orvex_demo'; $env:ALLOW_DESTRUCTIVE_RESET='true'; node database/migrate.js; Remove-Item Env:ALLOW_DESTRUCTIVE_RESET
$env:DB_NAME='orvex_demo'; npm run migrate:safe; npm run seed:safe
```

Bash:

```bash
DB_NAME=orvex_demo ALLOW_DESTRUCTIVE_RESET=true node database/migrate.js && DB_NAME=orvex_demo npm run migrate:safe && DB_NAME=orvex_demo npm run seed:safe
```

Después, fija `DB_NAME=orvex_demo` en `backend/.env`.

### 4.2 Base existente

- **Nunca ejecutes `schema.sql` ni `npm run migrate` sobre una base con datos.**
- `npm run migrate:safe` aplica todas las migraciones de `database/migrations/` (son aditivas e idempotentes).
- Migración nueva de esta entrega: **`007_codigos_solicitudes_legado.sql`**. Asigna un código `SOL-` a las solicitudes antiguas sin código, que la interfaz mostraba con su UUID interno. Solo modifica esas filas. Se aplicó a las bases QA; **no se aplicó a `orvex_test`**, que conserva 1 solicitud sin código. Para aplicarla solo esa migración:

  ```bash
  psql -U postgres -d orvex_test -f backend/database/migrations/007_codigos_solicitudes_legado.sql
  ```

## 5. Ejecutar en local

Terminal 1 — backend:

```bash
cd backend
npm install
npm start
```

Terminal 2 — frontend (desde la raíz):

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Salud del API: `http://localhost:3000/api/health`.

## 6. Usuarios de prueba

Definidos en [`backend/database/seed-safe.js`](./backend/database/seed-safe.js). La pantalla de inicio de sesión también ofrece accesos rápidos con estas cuentas.

| Rol | Nombre | Correo | Contraseña |
|---|---|---|---|
| Comercial / Recepción | Ana Martínez | ana.martinez@huellas.co | comercial123 |
| Coordinador de producción | Carlos Ruiz | carlos.gomez@huellas.co | coord123 |
| Diseñador gráfico | María López | maria.lopez@huellas.co | diseno123 |
| Operario (impresión) | Juan Pérez | pedro.morales@huellas.co | taller123 |
| Operario (acabados) | Pedro Ramírez | pedro.ramirez@huellas.co | taller123 |
| Atención postventa | Sofía Herrera | sofia.herrera@huellas.co | post123 |
| Gerencia | Andrés Torres | laura.sanchez@huellas.co | gerencia123 |

Algunos correos no coinciden con el nombre de la persona (por ejemplo `carlos.gomez@` corresponde a Carlos Ruiz). Así están en la base actual y se conservaron para no invalidar las cuentas existentes.

El rol **Cliente** no inicia sesión como usuario interno: los clientes, sus contactos, solicitudes y su historial siguen en el sistema y los gestiona Comercial / Recepción.

## 7. Roles y permisos

| Rol | Puede | No puede |
|---|---|---|
| Comercial / Recepción | Registrar clientes y solicitudes con cotización y anticipos, enviar a validación, corregir devueltas, registrar la respuesta del cliente sobre la versión enviada (aprobación con evidencia, cambios o sin respuesta) | Liberar a impresión, cambiar etapas |
| Coordinación | Validar, devolver o rechazar solicitudes (genera la orden), asignar equipo, liberar a impresión, mover etapas, crear tareas, registrar entregas, cerrar, reabrir y autorizar reimpresiones, operar inventario | Registrar solicitudes |
| Diseñador | Crear versiones y enviarlas a Comercial | Aprobar su propio diseño |
| Operario | Iniciar, pausar y finalizar sus tareas, registrar notas e incidencias y movimientos de inventario | Cambiar la etapa global, liberar, registrar entregas, modificar tareas ajenas |
| Postventa | Radicar y resolver casos PQRSF y garantías, solicitar reimpresión | Autorizar la reimpresión (lo hace Coordinación) |
| Gerencia | Consultar indicadores, reportes (PDF), trazabilidad, inventario (solo lectura) y administrar usuarios | Acciones operativas: validar, liberar, mover etapas, radicar casos, operar inventario o crear clientes |

Reglas críticas aplicadas en el backend:

- **RF-07:** no hay paso a impresión sin aprobación del cliente con evidencia y liberación de Coordinación.
- **RF-06:** Comercial solo gestiona la versión que el diseñador le envió. Aprobar una versión no enviada devuelve `409`.
- **Pagos:** un abono inválido (por ejemplo, mayor que la cotización) se rechaza sin dejar solicitud ni pagos parciales. La orden hereda la cotización, los abonos y el saldo.
- **Cierre:** no se cierra una orden con casos de postventa abiertos ni con reposiciones pendientes de entrega.

## 8. Modo demostración

Si el servidor o PostgreSQL **no están disponibles al iniciar sesión**, ORVEX entra en modo demostración con datos locales del navegador y muestra la etiqueta **«Modo demostración»** en la barra superior. Una sesión real **nunca** cambia en silencio a datos simulados: si el servidor falla después, la operación muestra un error y no se guarda.

## 9. Pruebas

Las suites **escriben datos**. Ejecútalas solo contra una base QA aislada, nunca contra la base de trabajo.

Crear una base QA copiando otra base sin modificarla:

```bash
pg_dump -U postgres -d orvex_test --no-owner -f orvex_snapshot.sql
```

```bash
createdb -U postgres orvex_qa
```

```bash
psql -U postgres -d orvex_qa -f orvex_snapshot.sql
```

Ejecutar todas las suites vigentes (el script se niega a correr sin `DB_NAME` o sobre `orvex_test`):

```powershell
cd backend; $env:DB_NAME='orvex_qa'; npm run test:all
```

Escenario integral de presentación: los seis roles con inicio de sesión real, de la solicitud con anticipo hasta el cierre y la trazabilidad, con 21 verificaciones:

```powershell
cd backend; $env:DB_NAME='orvex_qa'; npm run test:integration
```

`tests/integration.test.mjs` (`npm run test:legacy`) valida el flujo anterior a la migración 006 y falla por diseño. Se conserva como referencia histórica.

Compilación del frontend:

```bash
npm run build
```

## 10. Limitaciones conocidas

- No hay integración real con WhatsApp ni con correo. Comercial registra manualmente el canal, la persona que autorizó y la evidencia de la respuesta del cliente.
- Las notificaciones son internas: se calculan a partir de los datos cargados (solicitudes, diseños, tareas, casos) y se actualizan al recargar la información. No hay notificaciones push.
- Los indicadores de `/dashboard` se cargan al iniciar sesión. Para verlos actualizados después de operar, recarga la página.
- Los códigos de solicitud y orden usan el año fijo `2026` (`SOL-2026-`, `OP-2026-`).
- El paquete del frontend supera 500 kB (aviso de Vite). Funciona, pero no se ha dividido en partes.
- La pantalla de Postventa conserva algunos títulos de sección numerados y una paginación compacta propia; no se rediseñó por completo.

---

**ORVEX · Huellas Publicidad**
