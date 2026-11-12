import { useState, useEffect, useRef } from 'react'
import Icon from '../components/Icon.jsx'
import { ROLES, normalizarRol } from '../data/roles.js'
import { api } from '../services/api.js'
import {
  isFirebaseConfigured,
  loginWithEmailPassword,
  loginWithGoogle,
  resetPassword,
  logoutFirebase,
} from '../config/firebase.js'
import './Login.css'

// Credenciales oficiales de prueba para el prototipo
const CUENTAS_DEMO = [
  { rol: 'coordinador', usuario: 'jhon.avilahe@amigo.edu.co', clave: '', nombre: 'Carlos Ruiz', cargo: 'Coordinador de producción', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  { rol: 'comercial', usuario: 'jhonavila1038800612@gmail.com', clave: '', nombre: 'Ana Martínez', cargo: 'Comercial / Recepción', color: 'linear-gradient(135deg, #10b981, #059669)' },
  { rol: 'disenador', usuario: 'nicoohdz418@gmail.com', clave: '', nombre: 'María López', cargo: 'Diseñadora gráfica', color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
  { rol: 'operario', usuario: 'andresvarrera10@gmail.com', clave: '', nombre: 'Juan Pérez', cargo: 'Operario de impresión', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { rol: 'postventa', usuario: 'Victoriavi324@gmail.com', clave: '', nombre: 'Sofía Herrera', cargo: 'Atención postventa', color: 'linear-gradient(135deg, #ec4899, #db2777)' },
  { rol: 'gerencia', usuario: 'guidohernandezhdz@gmail.com', clave: '', nombre: 'Andrés Torres', cargo: 'Gerente general', color: 'linear-gradient(135deg, #06b6d4, #0284c7)' },
]

// Las 5 etapas del flujo integral de ORVEX
const ETAPAS_PRODUCCION = [
  { id: 'solicitud', nombre: 'Solicitud', icono: 'inbox', detalle: 'Recepción y cotización' },
  { id: 'diseno', nombre: 'Diseño', icono: 'pen', detalle: 'Creación de arte y pruebas' },
  { id: 'aprobacion', nombre: 'Aprobación', icono: 'check-circle', detalle: 'Validación del cliente' },
  { id: 'impresion', nombre: 'Impresión', icono: 'printer', detalle: 'Taller y producción' },
  { id: 'entrega', nombre: 'Entrega', icono: 'truck', detalle: 'Despacho con evidencias' },
]

export default function Login({ onLogin, onIrAlPortal }) {
  const [identificador, setIdentificador] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [cargandoGoogle, setCargandoGoogle] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')
  const [erroresCampos, setErroresCampos] = useState({})
  const [rolActivo, setRolActivo] = useState(null)

  // Estado para modal de recuperación de contraseña vía Firebase
  const [mostrarModalRecuperacion, setMostrarModalRecuperacion] = useState(false)
  const [correoRecuperacion, setCorreoRecuperacion] = useState('')
  const [mensajeRecuperacion, setMensajeRecuperacion] = useState('')
  const [cargandoRecuperacion, setCargandoRecuperacion] = useState(false)

  const canvasRef = useRef(null)

  // Fondo animado de partículas luminosas y conexiones tipo red tecnológica
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Respetar preferencia de reducción de movimiento
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let animationFrameId
    let width = (canvas.width = canvas.parentElement.offsetWidth)
    let height = (canvas.height = canvas.parentElement.offsetHeight)

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return
      width = canvas.width = canvas.parentElement.offsetWidth
      height = canvas.height = canvas.parentElement.offsetHeight
    }

    window.addEventListener('resize', handleResize)

    // Crear partículas con movimiento lento y orgánico
    const count = Math.min(32, Math.max(16, Math.floor((width * height) / 38000)))
    const particles = []

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 1.8 + 1.2,
        color: i % 3 === 0 ? 'rgba(56, 189, 248, ' : i % 3 === 1 ? 'rgba(37, 99, 235, ' : 'rgba(96, 165, 250, ',
        baseAlpha: Math.random() * 0.45 + 0.25,
      })
    }

    function render() {
      ctx.clearRect(0, 0, width, height)

      // Conexiones entre nodos cercanos
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 115) {
            const alpha = (1 - dist / 115) * 0.16
            ctx.beginPath()
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`
            ctx.lineWidth = 1
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Dibujar partículas con halo sutil
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `${p.color}${p.baseAlpha})`
        ctx.shadowColor = '#38bdf8'
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  function validarCampos() {
    const err = {}
    if (!identificador.trim()) {
      err.identificador = 'Ingresa tu correo institucional o nombre de usuario.'
    }
    if (!clave) {
      err.clave = 'Ingresa tu contraseña.'
    }
    setErroresCampos(err)
    return Object.keys(err).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorGlobal('')
    if (!validarCampos()) return

    setCargando(true)
    const cleanIdent = identificador.trim()

    try {
      let res
      if (isFirebaseConfigured()) {
        try {
          // 1. Autenticar en Firebase Authentication
          const { idToken } = await loginWithEmailPassword(cleanIdent, clave)
          // 2. Validar ID Token y permisos autorizados en PostgreSQL
          res = await api.firebaseLogin(idToken)
        } catch (fbErr) {
          // Si el rechazo viene del backend por falta de autorización en PostgreSQL
          if (
            fbErr.status === 403 ||
            fbErr.message?.includes('Acceso denegado') ||
            fbErr.message?.includes('inactivo')
          ) {
            await logoutFirebase()
            throw fbErr
          }

          // Si el usuario aún no existe en Firebase (migración paulatina) o contraseña incorrecta en Firebase,
          // intentar autenticación directa de ORVEX en PostgreSQL para no bloquear la operación
          if (
            fbErr.code === 'auth/user-not-found' ||
            fbErr.code === 'auth/invalid-credential' ||
            fbErr.code === 'auth/wrong-password' ||
            fbErr.code === 'auth/invalid-email'
          ) {
            res = await api.login({
              identificador: cleanIdent,
              clave,
            })
          } else {
            throw fbErr
          }
        }
      } else {
        // Fallback cuando Firebase aún no tiene API Key en .env
        res = await api.login({
          identificador: cleanIdent,
          clave,
        })
      }

      const usr = res?.usuario || {}
      const rolUi = normalizarRol(usr.rolUi || usr.rol || 'coordinador')
      setRolActivo(rolUi)
      setCargando(false)
      onLogin(
        {
          id: usr.id,
          dbId: usr.uuid || usr.dbId,
          nombre: usr.nombre || ROLES[rolUi]?.usuario?.nombre || 'Usuario',
          correo: usr.correo || usr.email || cleanIdent,
          cargo: usr.cargo || ROLES[rolUi]?.usuario?.cargo || rolUi,
          rol: rolUi,
          rolBd: usr.rolBd || usr.rol,
        },
        rolUi
      )
    } catch (err) {
      setCargando(false)
      await logoutFirebase()
      setErrorGlobal(
        err.message ||
          'Credenciales incorrectas. Verifica tu usuario y contraseña, o utiliza uno de los accesos de demostración.'
      )
    }
  }

  async function handleGoogleLogin() {
    setErrorGlobal('')
    setCargandoGoogle(true)
    try {
      if (!isFirebaseConfigured()) {
        throw new Error('El acceso con Google requiere configurar VITE_FIREBASE_API_KEY en el archivo .env.')
      }
      const { idToken } = await loginWithGoogle()
      const res = await api.firebaseLogin(idToken)
      const usr = res?.usuario || {}
      const rolUi = normalizarRol(usr.rolUi || usr.rol || 'coordinador')
      setRolActivo(rolUi)
      setCargandoGoogle(false)
      onLogin(
        {
          id: usr.id,
          dbId: usr.uuid || usr.dbId,
          nombre: usr.nombre || ROLES[rolUi]?.usuario?.nombre || 'Usuario',
          correo: usr.correo || usr.email,
          cargo: usr.cargo || ROLES[rolUi]?.usuario?.cargo || rolUi,
          rol: rolUi,
          rolBd: usr.rolBd || usr.rol,
        },
        rolUi
      )
    } catch (err) {
      setCargandoGoogle(false)
      await logoutFirebase()
      setErrorGlobal(
        err.message || 'Error al iniciar sesión con Google. Verifica que tu correo esté registrado y activo en ORVEX.'
      )
    }
  }

  async function handleRecuperarClave(e) {
    e.preventDefault()
    if (!correoRecuperacion.trim()) return
    setCargandoRecuperacion(true)
    setMensajeRecuperacion('')
    try {
      await resetPassword(correoRecuperacion.trim())
      setMensajeRecuperacion('Se ha enviado un enlace de restablecimiento a tu correo electrónico.')
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setMensajeRecuperacion('No se encontró una cuenta de Firebase asociada a este correo.')
      } else {
        setMensajeRecuperacion(err.message || 'No se pudo enviar el correo de recuperación.')
      }
    } finally {
      setCargandoRecuperacion(false)
    }
  }

  function handleAccesoRapido(cuenta) {
    setRolActivo(cuenta.rol)
    setIdentificador(cuenta.usuario)
    setClave(cuenta.clave)
    setErroresCampos({})
    setErrorGlobal('')
  }

  return (
    <div className="orvex-login-root">
      {/* Capa de fondo animada */}
      <div className="orvex-login-bg-layer" aria-hidden="true">
        <canvas ref={canvasRef} className="orvex-login-canvas" />
        <div className="orvex-login-grid-overlay" />
        <div className="orvex-login-orb orvex-login-orb-1" />
        <div className="orvex-login-orb orvex-login-orb-2" />
        <div className="orvex-login-orb orvex-login-orb-3" />
      </div>

      {/* Contenedor central a 2 columnas */}
      <div className="orvex-login-container">
        {/* Columna Izquierda: Presentación Institucional y Flujo ORVEX */}
        <section className="orvex-presentation-col" aria-label="Presentación del sistema ORVEX">
          {/* Identidad corporativa */}
          <div className="orvex-brand-header">
            <div className="orvex-logo-glow">
              <svg viewBox="0 0 40 40" width="50" height="50" aria-label="Logo ORVEX">
                <defs>
                  <linearGradient id="orvexLogoGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
                <rect width="40" height="40" rx="12" fill="url(#orvexLogoGrad)" />
                <circle cx="20" cy="20" r="9" fill="none" stroke="#ffffff" strokeWidth="3.2" />
                <path d="M13 29 L27 11" stroke="#bae6fd" strokeWidth="3.2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="orvex-brand-meta">
              <div className="orvex-brand-title-wrap">
                <span className="orvex-brand-title">ORVEX</span>
                <span className="orvex-badge-pro">SaaS Enterprise</span>
              </div>
              <span className="orvex-brand-sub">Huellas Publicidad</span>
            </div>
          </div>

          {/* Mensaje de impacto */}
          <div className="orvex-headline-section">
            <div className="orvex-headline-tag">
              <span className="orvex-headline-tag-dot" />
              Gestión Integral de Producción
            </div>
            <h1 className="orvex-headline-title">
              Todo tu proceso de producción, <span className="orvex-headline-gradient">en un solo lugar</span>.
            </h1>
            <p className="orvex-headline-desc">
              Centraliza solicitudes comerciales, versionado de artes gráficos, aprobaciones directas con el cliente, ejecución en taller y entrega certificada de pedidos publicitarios.
            </p>
          </div>

          {/* Visualización secuencial de las 5 etapas conectadas */}
          <div className="orvex-stages-workflow" aria-label="Flujo de 5 etapas de producción publicitaria">
            <div className="orvex-stages-header">
              <span className="orvex-stages-label">
                <Icon nombre="layers" tamano={15} /> Flujo de trabajo unificado
              </span>
              <span className="orvex-stages-status">5 etapas integradas</span>
            </div>

            <div className="orvex-stages-track">
              <div className="orvex-track-line-bg" />
              <div className="orvex-track-line-pulse" />

              {ETAPAS_PRODUCCION.map((etapa) => (
                <div key={etapa.id} className="orvex-stage-node" title={`${etapa.nombre}: ${etapa.detalle}`}>
                  <div className="orvex-stage-icon-box">
                    <Icon nombre={etapa.icono} tamano={18} />
                  </div>
                  <span className="orvex-stage-name">{etapa.nombre}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Píldoras de valor arquitectónico */}
          <div className="orvex-features-pills">
            <div className="orvex-feature-pill">
              <Icon nombre="check" tamano={14} /> Control de versiones de arte
            </div>
            <div className="orvex-feature-pill">
              <Icon nombre="activity" tamano={14} /> Trazabilidad cronológica
            </div>
            <div className="orvex-feature-pill">
              <Icon nombre="shield" tamano={14} /> Seguridad de producción
            </div>
          </div>
        </section>

        {/* Columna Derecha: Tarjeta de Acceso Seguro */}
        <section className="orvex-login-card-col" aria-label="Formulario de inicio de sesión">
          <div className="orvex-login-card">
            <div className="orvex-card-header">
              <div className="orvex-card-badge">
                <Icon nombre="lock" tamano={13} /> Acceso Corporativo
              </div>
              <h2 className="orvex-card-title">Bienvenido a ORVEX</h2>
              <p className="orvex-card-subtitle">
                Ingresa tus credenciales para acceder a la plataforma.
              </p>
            </div>

            {/* Alerta de error global */}
            {errorGlobal && (
              <div className="orvex-login-alert" role="alert">
                <span className="orvex-alert-icon">
                  <Icon nombre="alert-triangle" tamano={18} />
                </span>
                <span className="orvex-alert-text">{errorGlobal}</span>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmit} noValidate className="orvex-login-form">
              <div className={`orvex-form-field ${erroresCampos.identificador ? 'has-error' : ''}`}>
                <label className="orvex-input-label" htmlFor="loginIdentificador">
                  Correo o usuario institucional
                </label>
                <div className="orvex-input-wrap">
                  <span className="orvex-input-icon">
                    <Icon nombre="mail" tamano={17} />
                  </span>
                  <input
                    id="loginIdentificador"
                    className="orvex-input"
                    type="text"
                    autoComplete="username"
                    value={identificador}
                    placeholder="ej. carlos.gomez@huellas.co"
                    onChange={(e) => {
                      setIdentificador(e.target.value)
                      if (erroresCampos.identificador) {
                        setErroresCampos((prev) => ({ ...prev, identificador: '' }))
                      }
                    }}
                  />
                </div>
                {erroresCampos.identificador && (
                  <span className="orvex-field-error-text">
                    <Icon nombre="alert-circle" tamano={13} />
                    {erroresCampos.identificador}
                  </span>
                )}
              </div>

              <div className={`orvex-form-field ${erroresCampos.clave ? 'has-error' : ''}`}>
                <div className="orvex-input-label-row">
                  <label className="orvex-input-label" htmlFor="loginClave">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    className="orvex-forgot-btn"
                    onClick={() => {
                      setMostrarModalRecuperacion(true)
                      setCorreoRecuperacion(identificador.trim())
                      setMensajeRecuperacion('')
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="orvex-input-wrap">
                  <span className="orvex-input-icon">
                    <Icon nombre="lock" tamano={17} />
                  </span>
                  <input
                    id="loginClave"
                    className="orvex-input orvex-input-password"
                    type={verClave ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={clave}
                    placeholder="••••••••"
                    onChange={(e) => {
                      setClave(e.target.value)
                      if (erroresCampos.clave) {
                        setErroresCampos((prev) => ({ ...prev, clave: '' }))
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="orvex-toggle-pwd"
                    onClick={() => setVerClave(!verClave)}
                    aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                    title={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <Icon nombre={verClave ? 'eye-off' : 'eye'} tamano={16} />
                  </button>
                </div>
                {erroresCampos.clave && (
                  <span className="orvex-field-error-text">
                    <Icon nombre="alert-circle" tamano={13} />
                    {erroresCampos.clave}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="orvex-submit-btn"
                disabled={cargando || cargandoGoogle}
                aria-busy={cargando}
              >
                {cargando ? (
                  <>
                    <Icon nombre="refresh" tamano={18} className="spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <span>Iniciar sesión</span>
                )}
              </button>

              <div className="orvex-login-divider">
                <span>o</span>
              </div>

              <button
                type="button"
                className="orvex-google-btn"
                onClick={handleGoogleLogin}
                disabled={cargandoGoogle || cargando}
                aria-label="Continuar con Google"
              >
                {cargandoGoogle ? (
                  <>
                    <Icon nombre="refresh" tamano={18} className="spin" />
                    <span>Conectando con Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="orvex-google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Continuar con Google</span>
                  </>
                )}
              </button>
            </form>

            {/* Accesos rápidos de demostración */}
            <div className="orvex-demo-section">
              <div className="orvex-demo-header">
                <span className="orvex-demo-title">
                  <Icon nombre="users" tamano={14} /> Accesos de demostración (1 clic)
                </span>
                <span className="orvex-demo-pill">6 Roles internos</span>
              </div>

              <div className="orvex-demo-grid">
                {CUENTAS_DEMO.map((cuenta) => {
                  const inicial = cuenta.nombre.charAt(0)
                  const nombreRol = cuenta.rol.charAt(0).toUpperCase() + cuenta.rol.slice(1)

                  return (
                    <button
                      key={cuenta.rol}
                      type="button"
                      className="orvex-demo-btn"
                      onClick={() => handleAccesoRapido(cuenta)}
                      title={`Ingresar como ${cuenta.nombre} (${cuenta.cargo})`}
                      style={rolActivo === cuenta.rol ? { borderColor: '#38bdf8', background: 'rgba(56, 189, 248, 0.18)' } : {}}
                    >
                      <div className="orvex-demo-avatar" style={{ background: cuenta.color }}>
                        {inicial}
                      </div>
                      <div className="orvex-demo-info">
                        <span className="orvex-demo-role-name">{nombreRol}</span>
                        <span className="orvex-demo-role-user">{cuenta.nombre}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Acceso directo al Portal Público de Clientes */}
            <div style={{ marginTop: '20px', textAlign: 'center', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={onIrAlPortal}
                style={{
                  background: 'rgba(2, 132, 199, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>📦</span> ¿Eres cliente? Consulta tu pedido o radica una PQRSF
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Modal de Restablecimiento de Contraseña vía Firebase */}
      {mostrarModalRecuperacion && (
        <div
          className="orvex-modal-backdrop"
          onClick={() => setMostrarModalRecuperacion(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="orvex-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="orvex-modal-header">
              <div className="orvex-modal-title-row">
                <Icon nombre="lock" tamano={18} />
                <h3>Restablecer contraseña</h3>
              </div>
              <button
                type="button"
                className="orvex-modal-close"
                onClick={() => setMostrarModalRecuperacion(false)}
                aria-label="Cerrar modal"
              >
                <Icon nombre="x" tamano={18} />
              </button>
            </div>

            <p className="orvex-modal-desc">
              Ingresa el correo institucional registrado en ORVEX. Te enviaremos un enlace oficial de Firebase para restablecer tu contraseña.
            </p>

            <form onSubmit={handleRecuperarClave} className="orvex-modal-form">
              <div className="orvex-form-field">
                <label className="orvex-input-label" htmlFor="recupEmail">
                  Correo registrado
                </label>
                <div className="orvex-input-wrap">
                  <span className="orvex-input-icon">
                    <Icon nombre="mail" tamano={17} />
                  </span>
                  <input
                    id="recupEmail"
                    type="email"
                    className="orvex-input"
                    placeholder="ej. carlos.gomez@huellas.co"
                    value={correoRecuperacion}
                    onChange={(e) => setCorreoRecuperacion(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {mensajeRecuperacion && (
                <div
                  className={`orvex-modal-alert ${
                    mensajeRecuperacion.includes('enviado') ? 'is-success' : 'is-error'
                  }`}
                  role="alert"
                >
                  <Icon
                    nombre={mensajeRecuperacion.includes('enviado') ? 'check-circle' : 'alert-circle'}
                    tamano={16}
                  />
                  <span>{mensajeRecuperacion}</span>
                </div>
              )}

              <div className="orvex-modal-actions">
                <button
                  type="button"
                  className="orvex-modal-cancel-btn"
                  onClick={() => setMostrarModalRecuperacion(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="orvex-modal-submit-btn"
                  disabled={cargandoRecuperacion}
                >
                  {cargandoRecuperacion ? 'Enviando enlace...' : 'Enviar enlace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
