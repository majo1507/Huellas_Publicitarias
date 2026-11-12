# Estado de Respaldo y Guía de Continuación de ORVEX

**Última Actualización:** 12 de Noviembre de 2026 — 00:50 (GMT-5)  
**Rama de Trabajo:** `integracion-orvex`  
**Repositorio Principal:** `https://github.com/majo1507/Huellas_Publicitarias.git`  
**Repositorio Personal:** `https://github.com/jhonavilahe-del/ORVEX.git`  

---

## 1. Resumen de Respaldos

### A. Repositorio Remoto en GitHub
Los cambios fueron consolidados y subidos a los repositorios remotos:
* **Rama:** `integracion-orvex`
* **Estado:** Árbol de trabajo 100% limpio (`working tree clean`).
* **Archivos Protegidos:** `backend/.env`, certificados, tokens y uploads locales están estrictamente excluidos mediante `.gitignore` y **nunca** se suben a GitHub.

### B. Almacenamiento Local Seguro
* `backend/.env` permanece en su ubicación intacta.
* Se mantiene un respaldo local de seguridad: `backend/.env.backup.local`.
* **Variables confirmadas en local:**
  * `WHATSAPP_PHONE_NUMBER_ID=1336963382844434`
  * `WHATSAPP_BUSINESS_ACCOUNT_ID=962280323309387`
  * `WHATSAPP_ACCESS_TOKEN` (Token tipo System User, permanente)
  * `WHATSAPP_WEBHOOK_VERIFY_TOKEN=orvex_wa_verify_2026_secure`
  * `WHATSAPP_VERIFY_TOKEN=orvex_wa_verify_2026_secure`
  * Credenciales de base de datos PostgreSQL, JWT Secret y Gmail.

### C. Base de Datos PostgreSQL
PostgreSQL almacena los datos en disco de forma permanente en el servicio de Windows:
* Base de datos: `orvex_test`
* 20 tablas operativas verificadas con todos sus registros intactos (órdenes, solicitudes, usuarios, clientes, mensajes entrantes, postventa, inventario).

---

## 2. Instrucciones para Iniciar ORVEX

Al encender el computador o retomar la sesión, abre tu terminal en la carpeta del proyecto:  
`C:\Users\Alex\Desktop\Huellas publicidad`

### Paso 1: Iniciar el Backend (Puerto 3000)
```powershell
node backend/index.js
```
*Verás la confirmación:* `🚀 Servidor Huellas activo en: http://localhost:3000` y `✅ [PostgreSQL] Conexión establecida`.

### Paso 2: Iniciar el Frontend (Puerto 5173)
En una segunda terminal:
```powershell
npm run dev
```
*Abre tu navegador en:* `http://localhost:5173` para entrar a ORVEX.

### Paso 3: Iniciar el Túnel ngrok con Dominio Fijo Permanente
Para conectar WhatsApp Business Cloud API de Meta con tu backend local de forma fija:
```powershell
ngrok http --url=confidant-fondue-twerp.ngrok-free.dev 3000
```

> [!TIP]
> **¡Ventaja del dominio fijo!**
> Al utilizar tu dominio reservado `confidant-fondue-twerp.ngrok-free.dev`, la dirección HTTPS **nunca cambia**:
> * **URL permanente del Webhook:** `https://confidant-fondue-twerp.ngrok-free.dev/api/comunicaciones/whatsapp/webhook`
> * **Verify Token:** `orvex_wa_verify_2026_secure`
> Ya **no** tienes que reconfigurar el webhook en Meta for Developers cada vez que reinicias el túnel o Windows.

---

## 3. Conclusión
El proyecto está completamente respaldado, las credenciales están seguras en el entorno local y la configuración del túnel ngrok con dominio fijo garantiza persistencia total.
