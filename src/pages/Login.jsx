import { useState, useEffect, useRef } from 'react'
import Icon from '../components/Icon.jsx'
import { ROLES, normalizarRol } from '../data/roles.js'
import { api } from '../services/api.js'
import './Login.css'

// Credenciales oficiales de prueba para el prototipo
const CUENTAS_DEMO = [
  { rol: 'coordinador', usuario: 'carlos.gomez@huellas.co', clave: 'coord123', nombre: 'Carlos Ruiz', cargo: 'Coordinador de producción', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  { rol: 'comercial', usuario: 'ana.martinez@huellas.co', clave: 'comercial123', nombre: 'Ana Martínez', cargo: 'Comercial / Recepción', color: 'linear-gradient(135deg, #10b981, #059669)' },
  { rol: 'disenador', usuario: 'maria.lopez@huellas.co', clave: 'diseno123', nombre: 'María López', cargo: 'Diseñadora gráfica', color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
  { rol: 'operario', usuario: 'pedro.morales@huellas.co', clave: 'taller123', nombre: 'Juan Pérez', cargo: 'Operario de impresión', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { rol: 'postventa', usuario: 'sofia.herrera@huellas.co', clave: 'post123', nombre: 'Sofía Herrera', cargo: 'Atención postventa', color: 'linear-gradient(135deg, #ec4899, #db2777)' },
  { rol: 'gerencia', usuario: 'laura.sanchez@huellas.co', clave: 'gerencia123', nombre: 'Andrés Torres', cargo: 'Gerente general', color: 'linear-gradient(135deg, #06b6d4, #0284c7)' },
]

// Las 5 etapas del flujo integral de ORVEX
const ETAPAS_PRODUCCION = [
  { id: 'solicitud', nombre: 'Solicitud', icono: 'inbox', detalle: 'Recepción y cotización' },
  { id: 'diseno', nombre: 'Diseño', icono: 'pen', detalle: 'Creación de arte y pruebas' },
  { id: 'aprobacion', nombre: 'Aprobación', icono: 'check-circle', detalle: 'Validación del cliente' },
  { id: 'impresion', nombre: 'Impresión', icono: 'printer', detalle: 'Taller y producción' },
  { id: 'entrega', nombre: 'Entrega', icono: 'truck', detalle: 'Despacho con evidencias' },
]

export default function Login({ onLogin }) {
  const [identificador, setIdentificador] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')
  const [erroresCampos, setErroresCampos] = useState({})
  const [rolActivo, setRolActivo] = useState(null)

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
    try {
      const res = await api.login({
        identificador: identificador.trim(),
        clave,
      })
      const usr = res?.usuario || {}
      const rolUi = normalizarRol(usr.rolUi || usr.rol || 'coordinador')
      setRolActivo(rolUi)
      setCargando(false)
      onLogin(
        {
          id: usr.id,
          dbId: usr.uuid || usr.dbId,
          nombre: usr.nombre || ROLES[rolUi]?.usuario?.nombre || 'Usuario',
          correo: usr.correo || usr.email || identificador.trim(),
          cargo: usr.cargo || ROLES[rolUi]?.usuario?.cargo || rolUi,
          rol: rolUi,
          rolBd: usr.rolBd || usr.rol,
        },
        rolUi
      )
    } catch (err) {
      setCargando(false)
      setErrorGlobal(
        err.message ||
          'Credenciales incorrectas. Verifica tu usuario y contraseña, o utiliza uno de los accesos de demostración.'
      )
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
                <label className="orvex-input-label" htmlFor="loginClave">
                  Contraseña
                </label>
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
                disabled={cargando}
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
          </div>
        </section>
      </div>
    </div>
  )
}
