import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import Avatar from '../components/Avatar.jsx'
import { ROLES, LISTA_ROLES } from '../data/roles.js'

// Credenciales de prueba para el prototipo
const CUENTAS_DEMO = [
  { rol: 'coordinador', usuario: 'carlos.gomez@huellas.co', clave: 'coord123', nombre: 'Carlos Gómez', cargo: 'Coordinador de producción' },
  { rol: 'comercial', usuario: 'ana.martinez@huellas.co', clave: 'comercial123', nombre: 'Ana Martínez', cargo: 'Ejecutiva comercial' },
  { rol: 'disenador', usuario: 'maria.lopez@huellas.co', clave: 'diseno123', nombre: 'María López', cargo: 'Diseñadora gráfica' },
  { rol: 'operario', usuario: 'pedro.morales@huellas.co', clave: 'taller123', nombre: 'Pedro Morales', cargo: 'Operario de taller' },
  { rol: 'postventa', usuario: 'sofia.herrera@huellas.co', clave: 'post123', nombre: 'Sofía Herrera', cargo: 'Atención postventa' },
  { rol: 'gerencia', usuario: 'laura.sanchez@huellas.co', clave: 'gerencia123', nombre: 'Laura Sánchez', cargo: 'Gerente general' },
  { rol: 'cliente', usuario: 'carlos.mendoza@alpina.com', clave: 'cliente123', nombre: 'Carlos Mendoza', cargo: 'Cliente (Alpina S.A.)' },
]

export default function Login({ onLogin }) {
  const [identificador, setIdentificador] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')
  const [erroresCampos, setErroresCampos] = useState({})

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

  function ejecutarInicio(usuarioElegido, rolElegido) {
    setCargando(true)
    setErrorGlobal('')
    setTimeout(() => {
      setCargando(false)
      onLogin(usuarioElegido, rolElegido)
    }, 450)
  }

  function handleSubmit(e) {
    e.preventDefault()
    setErrorGlobal('')
    if (!validarCampos()) return

    const cuenta = CUENTAS_DEMO.find(
      (c) =>
        (c.usuario.toLowerCase() === identificador.trim().toLowerCase() ||
          c.nombre.toLowerCase() === identificador.trim().toLowerCase()) &&
        c.clave === clave
    )

    if (!cuenta) {
      setErrorGlobal('Credenciales incorrectas. Verifica tu usuario y contraseña, o utiliza uno de los accesos de prueba.')
      return
    }

    const rolData = ROLES[cuenta.rol]
    ejecutarInicio(
      {
        nombre: cuenta.nombre,
        correo: cuenta.usuario,
        cargo: cuenta.cargo,
        rol: cuenta.rol,
      },
      cuenta.rol
    )
  }

  function handleAccesoRapido(cuenta) {
    setIdentificador(cuenta.usuario)
    setClave(cuenta.clave)
    setErroresCampos({})
    setErrorGlobal('')
    const rolData = ROLES[cuenta.rol]
    ejecutarInicio(
      {
        nombre: cuenta.nombre,
        correo: cuenta.usuario,
        cargo: cuenta.cargo,
        rol: cuenta.rol,
      },
      cuenta.rol
    )
  }

  return (
    <div className="login-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: 'var(--bg-app)' }}>
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Marca superior */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
            <svg viewBox="0 0 40 40" width="44" height="44" aria-hidden="true">
              <defs>
                <linearGradient id="orvexGradLogin" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#60a5fa" />
                  <stop offset="1" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              <rect width="40" height="40" rx="11" fill="url(#orvexGradLogin)" />
              <circle cx="20" cy="20" r="9" fill="none" stroke="#fff" strokeWidth="3.4" />
              <path d="M13 29 L27 11" stroke="#bfe0ff" strokeWidth="3.4" strokeLinecap="round" />
            </svg>
            <div style={{ textAlign: 'left' }}>
              <strong style={{ fontSize: '1.45rem', letterSpacing: '-0.02em', display: 'block', lineHeight: 1.1, color: 'var(--text-main)' }}>ORVEX</strong>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Huellas Publicidad</small>
            </div>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Plataforma de gestión de producción publicitaria
          </p>
        </div>

        {/* Tarjeta de Login */}
        <div className="card p" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '1.25rem', margin: '0 0 4px', fontWeight: 600 }}>Iniciar sesión</h2>
            <p className="sm mut" style={{ margin: 0 }}>Ingresa con tus credenciales asignadas.</p>
          </div>

          {errorGlobal && (
            <div className="alert alert-error" style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }} role="alert">
              <span style={{ color: 'var(--state-red)', marginTop: '2px' }}><Icon nombre="alert-triangle" tamano={18} /></span>
              <span style={{ fontSize: '0.88rem', lineHeight: 1.4 }}>{errorGlobal}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
              <div className={`field full ${erroresCampos.identificador ? 'has-error' : ''}`}>
                <label className="field-label" htmlFor="loginIdentificador">
                  Correo o usuario institucional
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="loginIdentificador"
                    type="text"
                    autoComplete="username"
                    value={identificador}
                    placeholder="ej. ana.martinez@huellas.co"
                    onChange={(e) => {
                      setIdentificador(e.target.value)
                      if (erroresCampos.identificador) {
                        setErroresCampos((prev) => ({ ...prev, identificador: '' }))
                      }
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                {erroresCampos.identificador && <span className="field-error">{erroresCampos.identificador}</span>}
              </div>

              <div className={`field full ${erroresCampos.clave ? 'has-error' : ''}`}>
                <label className="field-label" htmlFor="loginClave">
                  Contraseña
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="loginClave"
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
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setVerClave(!verClave)}
                    style={{ position: 'absolute', right: '6px', background: 'transparent' }}
                    aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                    title={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <Icon nombre={verClave ? 'eye-off' : 'eye'} tamano={16} />
                  </button>
                </div>
                {erroresCampos.clave && <span className="field-error">{erroresCampos.clave}</span>}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={cargando}
              style={{ width: '100%', marginTop: '18px', justifyContent: 'center', height: '42px', fontSize: '0.95rem' }}
            >
              {cargando ? (
                <>
                  <Icon nombre="refresh" tamano={16} className="spin" /> Verificando...
                </>
              ) : (
                <>
                  <Icon nombre="check" tamano={16} /> Iniciar sesión
                </>
              )}
            </button>
          </form>

          {/* Accesos rápidos de demostración */}
          <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span className="sm mut" style={{ fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Acceso demo por rol (1 clic)
              </span>
              <span className="pill" style={{ fontSize: '0.72rem' }}>Prototipo</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {CUENTAS_DEMO.map((c) => (
                <button
                  key={c.rol}
                  type="button"
                  className="btn btn-soft btn-sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '6px 8px', fontSize: '0.8rem', gap: '6px' }}
                  onClick={() => handleAccesoRapido(c)}
                  title={`Ingresar como ${c.nombre} (${c.cargo})`}
                >
                  <Avatar nombre={c.nombre} tamano="xs" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.rol.charAt(0).toUpperCase() + c.rol.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Nota técnica de integración con backend */}
        <p className="sm mut" style={{ textAlign: 'center', fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>
          <strong>Nota de arquitectura:</strong> En este prototipo se utiliza autenticación simulada con perfiles locales. En producción, las credenciales se validarán contra el backend mediante JWT / OAuth2 seguro.
        </p>
      </div>
    </div>
  )
}
