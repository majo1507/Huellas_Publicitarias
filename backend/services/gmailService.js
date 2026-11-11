// ============================================================
// services/gmailService.js — Integración Oficial Gmail API con OAuth 2.0
// ORVEX — Huellas Publicidad (Entorno Normal: Node.js Express / PostgreSQL)
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Rutas de almacenamiento local cifrado (Sin migraciones en base de datos)
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const TOKEN_FILE_PATH = path.join(CONFIG_DIR, '.gmail_token.enc');
const NONCES_FILE_PATH = path.join(CONFIG_DIR, '.used_nonces.json');

// Duración del refresh token en estado «Prueba» de Google Cloud (7 días)
const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const DIEZ_MINUTOS_MS = 10 * 60 * 1000;

/**
 * Obtiene la clave de 32 bytes validada para AES-256-GCM y HMAC.
 */
function obtenerClaveCifrado() {
  const claveHex = String(process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!claveHex) {
    throw new Error('Falta la variable de entorno GMAIL_TOKEN_ENCRYPTION_KEY.');
  }
  const keyBuf = Buffer.from(claveHex, 'hex');
  if (keyBuf.length !== 32) {
    throw new Error(
      `GMAIL_TOKEN_ENCRYPTION_KEY inválida: se requieren exactamente 32 bytes (64 caracteres hex). Longitud actual: ${keyBuf.length} bytes.`
    );
  }
  return keyBuf;
}

/**
 * Cifra un objeto JavaScript usando AES-256-GCM.
 */
function cifrarPayload(objeto) {
  const key = obtenerClaveCifrado();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const jsonStr = JSON.stringify(objeto);
  let enc = cipher.update(jsonStr, 'utf8', 'hex');
  enc += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    v: 1,
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    data: enc,
  });
}

/**
 * Descifra el payload cifrado usando AES-256-GCM.
 */
function descifrarPayload(contenidoArchivo) {
  const key = obtenerClaveCifrado();
  const parsed = JSON.parse(contenidoArchivo);
  const iv = Buffer.from(parsed.iv, 'hex');
  const authTag = Buffer.from(parsed.tag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let dec = decipher.update(parsed.data, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return JSON.parse(dec);
}

/**
 * Lee los tokens almacenados en disco de forma segura.
 */
function leerTokensGuardados() {
  if (!fs.existsSync(TOKEN_FILE_PATH)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(TOKEN_FILE_PATH, 'utf8');
    return descifrarPayload(raw);
  } catch (err) {
    console.error('[GmailService] Error al descifrar el almacén de tokens local:', err.message);
    return null;
  }
}

/**
 * Guarda los tokens cifrados en disco creando el directorio si no existe.
 */
function guardarTokensCifrados(tokensObj) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  const rawCifrado = cifrarPayload(tokensObj);
  fs.writeFileSync(TOKEN_FILE_PATH, rawCifrado, { mode: 0o600, encoding: 'utf8' });
}

/**
 * Manejo de nonces para garantizar que el state OAuth sea de UN SOLO USO.
 */
function registrarNonceUsado(nonce) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  let nonces = {};
  if (fs.existsSync(NONCES_FILE_PATH)) {
    try {
      nonces = JSON.parse(fs.readFileSync(NONCES_FILE_PATH, 'utf8'));
    } catch (_) {
      nonces = {};
    }
  }

  // Purgar nonces con más de 15 minutos de antigüedad
  const ahora = Date.now();
  const limpiados = {};
  for (const [k, exp] of Object.entries(nonces)) {
    if (exp > ahora) limpiados[k] = exp;
  }

  if (limpiados[nonce]) {
    return false; // Ya fue utilizado previamente
  }

  limpiados[nonce] = ahora + DIEZ_MINUTOS_MS;
  fs.writeFileSync(NONCES_FILE_PATH, JSON.stringify(limpiados, null, 2), { mode: 0o600 });
  return true;
}

/**
 * Genera un state OAuth 2.0 criptográfico, firmado con HMAC-SHA256 y con TTL de 10 minutos.
 */
function generarStateOAuth(usuarioId) {
  const key = obtenerClaveCifrado();
  const payload = {
    uid: usuarioId || 'gerente',
    iat: Date.now(),
    exp: Date.now() + DIEZ_MINUTOS_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = crypto.createHmac('sha256', key).update(dataStr).digest('base64url');
  return `${dataStr}.${firma}`;
}

/**
 * Valida la firma criptográfica, vigencia temporal y no-repetición del state OAuth.
 */
function validarStateOAuth(stateStr) {
  if (!stateStr || typeof stateStr !== 'string' || !stateStr.includes('.')) {
    return { valido: false, error: 'Formato de state OAuth inválido.' };
  }

  const [dataStr, firmaRecibida] = stateStr.split('.');
  const key = obtenerClaveCifrado();
  const firmaEsperada = crypto.createHmac('sha256', key).update(dataStr).digest('base64url');

  const bufRecibido = Buffer.from(firmaRecibida);
  const bufEsperado = Buffer.from(firmaEsperada);

  if (bufRecibido.length !== bufEsperado.length || !crypto.timingSafeEqual(bufRecibido, bufEsperado)) {
    return { valido: false, error: 'Firma criptográfica del state inválida o manipulada.' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
  } catch (_) {
    return { valido: false, error: 'Payload del state malformado.' };
  }

  if (Date.now() > payload.exp) {
    return { valido: false, error: 'El enlace de autorización expiró (vigencia máxima: 10 minutos). Por favor reintenta.' };
  }

  const nonceUnico = registrarNonceUsado(payload.nonce);
  if (!nonceUnico) {
    return { valido: false, error: 'El state OAuth ya fue utilizado. No se permiten solicitudes duplicadas.' };
  }

  return { valido: true, payload };
}

/**
 * Genera la URL completa de consentimiento OAuth 2.0 de Google.
 */
function generarUrlAutorizacion(usuarioId) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/comunicaciones/gmail/callback';
  const emailObjetivo = process.env.GMAIL_USER_EMAIL || 'huellaspublicidad23@gmail.com';

  if (!clientId) {
    throw new Error('Falta configurar GMAIL_CLIENT_ID en backend/.env');
  }

  const state = generarStateOAuth(usuarioId);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
    login_hint: emailObjetivo,
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
  };
}

/**
 * Intercambia el código de autorización por tokens de Google y los almacena cifrados,
 * preservando el refresh_token previo si Google no retorna uno nuevo.
 */
async function intercambiarCodigoPorTokens(code, stateRecibido) {
  const validacion = validarStateOAuth(stateRecibido);
  if (!validacion.valido) {
    throw new Error(validacion.error);
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/comunicaciones/gmail/callback';
  const emailObjetivo = process.env.GMAIL_USER_EMAIL || 'huellaspublicidad23@gmail.com';

  if (!clientId || !clientSecret) {
    throw new Error('Credenciales de Gmail incompletas en backend/.env (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET).');
  }

  const bodyParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  const data = await resp.json();
  if (!resp.ok || data.error) {
    throw new Error(`Error de Google al intercambiar código: ${data.error_description || data.error || resp.statusText}`);
  }

  const tokensGuardados = leerTokensGuardados();

  // REGLA FUNDAMENTAL: Preservar refresh_token si Google no envió uno nuevo
  const refreshTokenFinal = data.refresh_token || tokensGuardados?.refresh_token;

  if (!refreshTokenFinal) {
    throw new Error(
      'Google no entregó un refresh_token y no existe un token previo registrado. ' +
      'Por favor revoca el acceso a la app en tu cuenta Google y reintenta con prompt=consent.'
    );
  }

  const ahora = Date.now();
  const nuevoTokenAlmacenado = {
    refresh_token: refreshTokenFinal,
    access_token: data.access_token,
    access_token_expira_en: ahora + (Number(data.expires_in || 3600) * 1000),
    // Si Google entregó un nuevo refresh_token se reinicia la cuenta de los 7 días de modo prueba
    token_emitido_en: data.refresh_token ? ahora : (tokensGuardados?.token_emitido_en || ahora),
    email: emailObjetivo,
    scope: data.scope || 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
    actualizado_en: ahora,
  };

  guardarTokensCifrados(nuevoTokenAlmacenado);
  return { ok: true, email: emailObjetivo, fechaEmision: nuevoTokenAlmacenado.token_emitido_en };
}

/**
 * Obtiene un access_token válido, renovándolo automáticamente mediante refresh_token si ha expirado.
 */
async function obtenerAccessTokenValido() {
  const tokens = leerTokensGuardados();
  if (!tokens || !tokens.refresh_token) {
    return null;
  }

  const ahora = Date.now();
  // Si el access_token aún tiene más de 60 segundos de vigencia, reutilizarlo directamente
  if (tokens.access_token && tokens.access_token_expira_en > ahora + 60000) {
    return tokens.access_token;
  }

  // Si venció o está por vencer, solicitar nuevo access_token con el refresh_token
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  const data = await resp.json();
  if (!resp.ok || data.error) {
    if (data.error === 'invalid_grant') {
      throw new Error(
        'La sesión de Gmail ha caducado en Google (límite de 7 días del modo prueba o acceso revocado). ' +
        'El administrador debe re-conectar la cuenta desde el Centro de Comunicaciones.'
      );
    }
    throw new Error(`Error al renovar access_token de Gmail: ${data.error_description || data.error}`);
  }

  tokens.access_token = data.access_token;
  tokens.access_token_expira_en = ahora + (Number(data.expires_in || 3600) * 1000);
  if (data.refresh_token) {
    tokens.refresh_token = data.refresh_token;
    tokens.token_emitido_en = ahora;
  }
  tokens.actualizado_en = ahora;

  guardarTokensCifrados(tokens);
  return tokens.access_token;
}

/**
 * Consulta el estado de conexión para la interfaz y cálculo de vigencia de los 7 días.
 * NUNCA retorna tokens ni claves secretas.
 */
function obtenerEstadoConexion() {
  const tokens = leerTokensGuardados();
  if (!tokens || !tokens.refresh_token) {
    return {
      conectado: false,
      email: null,
      diasRestantes: 0,
      horasRestantes: 0,
      requiereReautorizacion: false,
      avisoModoPrueba: 'Cuenta no conectada.',
    };
  }

  const ahora = Date.now();
  const emitidoEn = Number(tokens.token_emitido_en || ahora);
  const msTranscurridos = ahora - emitidoEn;
  const msRestantes = Math.max(0, SIETE_DIAS_MS - msTranscurridos);
  const horasRestantes = Math.round(msRestantes / (1000 * 60 * 60));
  const diasRestantes = Number((msRestantes / (1000 * 60 * 60 * 24)).toFixed(1));
  const scopeActual = String(tokens.scope || '');
  const tieneLectura = scopeActual.includes('gmail.readonly') || scopeActual.includes('mail.google.com');
  const requiereReautorizacion = msRestantes <= 0 || !tieneLectura;

  let avisoModoPrueba = '';
  if (msRestantes <= 0) {
    avisoModoPrueba = 'La sesión de prueba de 7 días ha finalizado. Requiere re-autorización en un clic.';
  } else if (!tieneLectura) {
    avisoModoPrueba = 'Se requiere actualizar la autorización de Google para habilitar la recepción automática de correos.';
  } else {
    avisoModoPrueba = `Modo Prueba: vigencia de refresh token: ${diasRestantes} días restantes (${horasRestantes}h). Recepción y envío activos.`;
  }

  return {
    conectado: true,
    email: tokens.email || process.env.GMAIL_USER_EMAIL || 'huellaspublicidad23@gmail.com',
    diasRestantes,
    horasRestantes,
    requiereReautorizacion,
    tieneLectura,
    fechaEmision: new Date(emitidoEn).toISOString(),
    avisoModoPrueba,
  };
}

/**
 * Desconecta la cuenta y borra el archivo cifrado.
 */
async function desconectarGmail() {
  const tokens = leerTokensGuardados();
  if (tokens && (tokens.access_token || tokens.refresh_token)) {
    try {
      const tokenParaRevocar = tokens.access_token || tokens.refresh_token;
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenParaRevocar)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (_) {
      // Best-effort revocación en Google
    }
  }

  if (fs.existsSync(TOKEN_FILE_PATH)) {
    fs.unlinkSync(TOKEN_FILE_PATH);
  }
  return { ok: true, mensaje: 'Cuenta de Gmail desconectada correctamente.' };
}

/**
 * Codifica una cadena en Base64URL segura para el parámetro `raw` de la API de Gmail.
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Construye un mensaje conforme al estándar RFC 2822 / MIME y lo envía mediante la API de Gmail.
 * Soporta respuestas en hilo (threadId, In-Reply-To, References).
 */
async function enviarCorreoGmail({ destinatario, asunto, texto, adjuntos = [], mensajeIdLocal, inReplyTo, references, threadId }) {
  if (!destinatario || !destinatario.includes('@')) {
    throw new Error(`Dirección de correo destinatario inválida: "${destinatario}".`);
  }

  const accessToken = await obtenerAccessTokenValido();
  if (!accessToken) {
    throw new Error('Gmail no está conectado. El administrador debe vincular la cuenta en el Centro de Comunicaciones.');
  }

  const fromEmail = process.env.GMAIL_USER_EMAIL || 'huellaspublicidad23@gmail.com';
  const remitenteNombre = 'Huellas Publicidad';
  const idMsgRFC = `<orvex-${mensajeIdLocal || Date.now()}-${crypto.randomBytes(4).toString('hex')}@${fromEmail.split('@')[1] || 'gmail.com'}>`;

  // Encabezados RFC 2822
  const headers = [
    `From: =?UTF-8?B?${Buffer.from(remitenteNombre).toString('base64')}?= <${fromEmail}>`,
    `To: <${destinatario.trim()}>`,
    `Subject: =?UTF-8?B?${Buffer.from(asunto || 'Mensaje de Huellas Publicidad').toString('base64')}?=`,
    `Message-ID: ${idMsgRFC}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo.startsWith('<') ? inReplyTo : `<${inReplyTo}>`}`);
  }
  if (references) {
    headers.push(`References: ${references}`);
  } else if (inReplyTo) {
    headers.push(`References: ${inReplyTo.startsWith('<') ? inReplyTo : `<${inReplyTo}>`}`);
  }

  const pieFirma = `\n\n---\nHuellas Publicidad · Gestión Integral de Producción\nPBX: (601) 300 111 2233 · Bogotá D.C., Colombia\nEste correo fue generado desde la plataforma empresarial ORVEX.`;
  const cuerpoCompleto = String(texto || '').trim() + pieFirma;
  const mensajeRawRFC2822 = headers.join('\r\n') + '\r\n\r\n' + cuerpoCompleto;

  const rawBase64Url = base64UrlEncode(mensajeRawRFC2822);

  const sendPayload = { raw: rawBase64Url };
  if (threadId) {
    sendPayload.threadId = threadId;
  }

  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sendPayload),
  });

  const data = await resp.json();
  if (!resp.ok || data.error) {
    const errDetalle = data.error?.message || data.error_description || resp.statusText;
    throw new Error(`Gmail API rechazó el envío: ${errDetalle} (Código: ${data.error?.code || resp.status})`);
  }

  return {
    ok: true,
    id: data.id,
    threadId: data.threadId,
    labelIds: data.labelIds,
    rfcMessageId: idMsgRFC,
    destinatario,
  };
}

/**
 * Convierte contenido HTML de correos a texto legible simple.
 */
function limpiarHtmlATexto(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Extrae recursivamente el cuerpo de texto de la estructura MIME de Gmail API.
 */
function extraerCuerpoTexto(payload) {
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, 'base64url').toString('utf8');
    } catch (_) {}
  }

  if (Array.isArray(payload.parts)) {
    // 1. Buscar preferentemente text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        try {
          return Buffer.from(part.body.data, 'base64url').toString('utf8');
        } catch (_) {}
      }
    }
    // 2. Partes anidadas (ej. multipart/alternative dentro de multipart/mixed)
    for (const part of payload.parts) {
      if (Array.isArray(part.parts)) {
        const sub = extraerCuerpoTexto(part);
        if (sub) return sub;
      }
    }
    // 3. Fallback: text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        try {
          const html = Buffer.from(part.body.data, 'base64url').toString('utf8');
          return limpiarHtmlATexto(html);
        } catch (_) {}
      }
    }
  }

  if (payload.mimeType === 'text/html' && payload.body?.data) {
    try {
      const html = Buffer.from(payload.body.data, 'base64url').toString('utf8');
      return limpiarHtmlATexto(html);
    } catch (_) {}
  }

  return '';
}

/**
 * Sincroniza correos entrantes desde la bandeja de entrada de Gmail hacia ORVEX.
 * Deduplica estrictamente por gmailMessageId, crea hilos y vincula clientes automáticamente sin migraciones.
 */
async function sincronizarCorreosEntrantes({ db }) {
  if (!db) {
    throw new Error('Se requiere instancia de base de datos para sincronizar.');
  }

  let accessToken;
  try {
    accessToken = await obtenerAccessTokenValido();
  } catch (err) {
    return { ok: false, razon: err.message };
  }

  if (!accessToken) {
    return { ok: false, razon: 'Gmail no está conectado.' };
  }

  // 1. Consultar últimos 25 mensajes de la bandeja de entrada
  let listResp;
  try {
    listResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=25', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (netErr) {
    return { ok: false, razon: 'Error de red al consultar Gmail API: ' + netErr.message };
  }

  if (!listResp.ok) {
    if (listResp.status === 403) {
      return {
        ok: false,
        razon: 'Permisos insuficientes: el token actual requiere el alcance de lectura (gmail.readonly). Requiere re-autorización.',
        requiereReautorizacion: true,
      };
    }
    return { ok: false, razon: `Gmail API error (${listResp.status}): ${listResp.statusText}` };
  }

  const listData = await listResp.json();
  const messages = Array.isArray(listData.messages) ? listData.messages : [];
  if (messages.length === 0) {
    return { ok: true, sincronizados: 0, nuevos: 0 };
  }

  const emailCorporativo = (process.env.GMAIL_USER_EMAIL || 'huellaspublicidad23@gmail.com').toLowerCase().trim();
  let nuevosContador = 0;

  for (const item of messages) {
    const gmailId = item.id;
    if (!gmailId) continue;

    // 2. Verificar deduplicación en la base de datos
    const { rows: existente } = await db.query(
      `SELECT id FROM mensajes_entrantes
       WHERE resumen LIKE $1
       LIMIT 1`,
      [`%"gmailMessageId":"${gmailId}"%`]
    );

    if (existente.length > 0) {
      continue; // Mensaje ya registrado previamente, se omite
    }

    // 3. Obtener detalle completo del correo
    try {
      const msgResp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!msgResp.ok) continue;

      const msgData = await msgResp.json();
      const headers = msgData.payload?.headers || [];
      const getH = (nombre) => headers.find((h) => h.name.toLowerCase() === nombre.toLowerCase())?.value || '';

      const fromHeader = getH('From');
      const toHeader = getH('To');
      const subjectHeader = getH('Subject') || '(Sin asunto)';
      const dateHeader = getH('Date');
      const messageIdHeader = getH('Message-ID');
      const inReplyToHeader = getH('In-Reply-To');
      const referencesHeader = getH('References');

      // Extraer dirección limpia y nombre
      const matchEmail = fromHeader.match(/<([^>]+)>/);
      const emailRemitente = (matchEmail ? matchEmail[1] : fromHeader).trim().toLowerCase();
      let nombreRemitente = fromHeader.replace(/<[^>]+>/, '').trim();
      if (nombreRemitente.startsWith('"') && nombreRemitente.endsWith('"')) {
        nombreRemitente = nombreRemitente.slice(1, -1).trim();
      }
      if (!nombreRemitente) {
        nombreRemitente = emailRemitente.split('@')[0] || 'Remitente';
      }

      // Si el correo fue enviado por nosotros mismos y llegó a inbox, clasificar como usuario
      const esNuestro = emailRemitente.includes(emailCorporativo);
      const de = esNuestro ? 'usuario' : 'cliente';
      const remitenteFinal = esNuestro ? 'Huellas Publicidad' : (nombreRemitente || emailRemitente);

      // Extraer cuerpo del texto
      const textoCuerpo = extraerCuerpoTexto(msgData.payload) || msgData.snippet || '(Mensaje sin contenido de texto)';

      // Fechas y horas
      const ts = msgData.internalDate ? parseInt(msgData.internalDate, 10) : (dateHeader ? Date.parse(dateHeader) : Date.now());
      const fechaObj = new Date(isNaN(ts) ? Date.now() : ts);
      const pad = (n) => String(n).padStart(2, '0');
      const fechaTexto = `${pad(fechaObj.getDate())}/${pad(fechaObj.getMonth() + 1)}/${fechaObj.getFullYear()}`;
      const horaTexto = `${pad(fechaObj.getHours())}:${pad(fechaObj.getMinutes())}`;

      // 4. Resolver o vincular Cliente
      let clienteId = null;
      const emailParaBuscar = esNuestro ? (toHeader.match(/<([^>]+)>/)?.[1] || toHeader).trim().toLowerCase() : emailRemitente;

      if (emailParaBuscar && emailParaBuscar.includes('@')) {
        const { rows: cliRows } = await db.query(
          'SELECT id FROM clientes WHERE LOWER(TRIM(correo)) = $1 LIMIT 1',
          [emailParaBuscar]
        );
        if (cliRows.length > 0) {
          clienteId = cliRows[0].id;
        } else {
          // Auto-crear cliente externo respetando constraints de clientes sin migraciones
          const { rows: ejecRows } = await db.query(
            "SELECT id FROM usuarios WHERE rol = 'ejecutiva' LIMIT 1"
          );
          const ejecutivaId = ejecRows[0]?.id;
          const codCli = `CLI-EXT-${Date.now().toString().slice(-4)}`;
          const nitCli = `EXT-${Date.now().toString().slice(-6)}`;
          const empresaNombre = `${nombreRemitente} (${emailParaBuscar})`;

          const { rows: newCli } = await db.query(
            `INSERT INTO clientes (empresa, nit, contacto_principal, correo, ejecutiva_id, estado, codigo)
             VALUES ($1, $2, $3, $4, $5, 'Nuevo', $6)
             RETURNING id`,
            [empresaNombre, nitCli, nombreRemitente, emailParaBuscar, ejecutivaId, codCli]
          );
          clienteId = newCli[0].id;
        }
      }

      // Si por alguna razón no se obtuvo clienteId, asignar el primer cliente existente
      if (!clienteId) {
        const { rows: primerCli } = await db.query('SELECT id FROM clientes LIMIT 1');
        clienteId = primerCli[0]?.id;
      }

      // 5. Vincular a Hilo existente o crear uno nuevo
      let canalId = null;
      const gmailThreadId = msgData.threadId;

      // 5A. Buscar hilo por threadId de Gmail
      if (gmailThreadId) {
        const { rows: porThread } = await db.query(
          `SELECT canal_id FROM mensajes_entrantes
           WHERE resumen LIKE $1
           LIMIT 1`,
          [`%"threadId":"${gmailThreadId}"%`]
        );
        if (porThread.length > 0) {
          canalId = porThread[0].canal_id;
        }
      }

      // 5B. Buscar hilo por In-Reply-To
      if (!canalId && inReplyToHeader) {
        const { rows: porRfc } = await db.query(
          `SELECT canal_id FROM mensajes_entrantes
           WHERE resumen LIKE $1
           LIMIT 1`,
          [`%"rfcMessageId":"${inReplyToHeader}"%`]
        );
        if (porRfc.length > 0) {
          canalId = porRfc[0].canal_id;
        }
      }

      // 5C. Buscar hilo abierto por cliente y asunto similar
      if (!canalId && clienteId) {
        const asuntoLimpio = subjectHeader.replace(/^(re|fwd):\s*/i, '').trim();
        const { rows: porAsunto } = await db.query(
          `SELECT id FROM canales_contacto
           WHERE cliente_id = $1 AND canal = 'mail'
             AND (asunto ILIKE $2 OR $3 ILIKE '%' || asunto || '%')
           ORDER BY created_at DESC
           LIMIT 1`,
          [clienteId, `%${asuntoLimpio}%`, asuntoLimpio]
        );
        if (porAsunto.length > 0) {
          canalId = porAsunto[0].id;
        }
      }

      // 5D. Si no existe hilo previo, crear nuevo en canales_contacto
      if (!canalId) {
        const codCanal = `COM-MAIL-${Date.now().toString().slice(-5)}`;
        const { rows: newCanal } = await db.query(
          `INSERT INTO canales_contacto (canal, cliente_id, asunto, estado, responsable_nombre, codigo)
           VALUES ('mail', $1, $2, 'Pendiente de respuesta', 'Ana Martínez', $3)
           RETURNING id`,
          [clienteId, subjectHeader, codCanal]
        );
        canalId = newCanal[0].id;
      }

      // 6. Insertar mensaje en mensajes_entrantes
      const resumenObj = {
        estadoEnvio: 'recibido',
        gmailMessageId: gmailId,
        threadId: gmailThreadId,
        rfcMessageId: messageIdHeader,
        inReplyTo: inReplyToHeader,
        references: referencesHeader,
        deCorreo: emailRemitente,
        paraCorreo: toHeader,
        asunto: subjectHeader,
        fechaRecibido: new Date(ts).toISOString(),
      };

      await db.query(
        `INSERT INTO mensajes_entrantes
           (canal_id, remitente, texto, de, fecha_texto, hora_texto, resumen, marca_tiempo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          canalId,
          remitenteFinal,
          textoCuerpo,
          de,
          fechaTexto,
          horaTexto,
          JSON.stringify(resumenObj),
          new Date(ts).toISOString(),
        ]
      );

      // Si es mensaje de cliente, actualizar estado del canal a Pendiente de respuesta
      if (de === 'cliente') {
        await db.query(
          "UPDATE canales_contacto SET estado = 'Pendiente de respuesta' WHERE id = $1",
          [canalId]
        );
      }

      nuevosContador++;
    } catch (msgErr) {
      console.error(`[GmailSync] Error al procesar mensaje ${gmailId}:`, msgErr.message);
    }
  }

  return { ok: true, sincronizados: messages.length, nuevos: nuevosContador };
}

module.exports = {
  generarUrlAutorizacion,
  intercambiarCodigoPorTokens,
  obtenerAccessTokenValido,
  obtenerEstadoConexion,
  desconectarGmail,
  enviarCorreoGmail,
  sincronizarCorreosEntrantes,
  extraerCuerpoTexto,
  limpiarHtmlATexto,
  validarStateOAuth,
  TOKEN_FILE_PATH,
};
