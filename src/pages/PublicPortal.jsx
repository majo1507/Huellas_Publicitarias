import React, { useState } from 'react'
import { api } from '../services/api.js'

export default function PublicPortal({ onVolverLogin }) {
  const [tabActiva, setTabActiva] = useState('pedido') // 'pedido' | 'pqrsf' | 'radicado'

  // Estados Consulta de Pedido
  const [consultaPedido, setConsultaPedido] = useState({ codigo: '', contacto: '' })
  const [cargandoPedido, setCargandoPedido] = useState(false)
  const [errorPedido, setErrorPedido] = useState('')
  const [resultadoPedido, setResultadoPedido] = useState(null)

  // Estados Radicación PQRSF
  const [formPQRSF, setFormPQRSF] = useState({
    nombre: '',
    email: '',
    telefono: '',
    tipo: 'Petición',
    ordenCodigo: '',
    descripcion: '',
  })
  const [archivoEvidencia, setArchivoEvidencia] = useState(null)
  const [cargandoRadicacion, setCargandoRadicacion] = useState(false)
  const [errorRadicacion, setErrorRadicacion] = useState('')
  const [radicadoGenerado, setRadicadoGenerado] = useState(null)

  // Estados Consulta de Radicado
  const [consultaRadicado, setConsultaRadicado] = useState({ radicado: '', email: '' })
  const [cargandoRadicado, setCargandoRadicado] = useState(false)
  const [errorRadicado, setErrorRadicado] = useState('')
  const [resultadoRadicado, setResultadoRadicado] = useState(null)

  // Manejar Consulta de Pedido
  const handleConsultarPedido = async (e) => {
    e.preventDefault()
    setErrorPedido('')
    setResultadoPedido(null)
    if (!consultaPedido.codigo.trim() || !consultaPedido.contacto.trim()) {
      setErrorPedido('Por favor ingrese el código del pedido y su número de teléfono, NIT o correo.')
      return
    }

    setCargandoPedido(true)
    try {
      const res = await api.consultarPedidoPublico({
        codigo: consultaPedido.codigo.trim(),
        contacto: consultaPedido.contacto.trim(),
      })
      if (res?.data) {
        setResultadoPedido(res.data)
      } else {
        setErrorPedido(res?.error || 'No fue posible consultar el pedido.')
      }
    } catch (err) {
      setErrorPedido(err.message || 'Error de conexión al consultar pedido.')
    } finally {
      setCargandoPedido(false)
    }
  }

  // Manejar Radicación PQRSF / Garantía
  const handleRadicarPQRSF = async (e) => {
    e.preventDefault()
    setErrorRadicacion('')
    if (!formPQRSF.nombre.trim() || !formPQRSF.email.trim() || !formPQRSF.descripcion.trim()) {
      setErrorRadicacion('Por favor complete los campos obligatorios (Nombre, Correo y Descripción).')
      return
    }

    setCargandoRadicacion(true)
    try {
      const formData = new FormData()
      formData.append('nombre', formPQRSF.nombre.trim())
      formData.append('email', formPQRSF.email.trim())
      formData.append('telefono', formPQRSF.telefono.trim())
      formData.append('tipo', formPQRSF.tipo)
      formData.append('ordenCodigo', formPQRSF.ordenCodigo.trim())
      formData.append('descripcion', formPQRSF.descripcion.trim())
      if (archivoEvidencia) {
        formData.append('evidencia', archivoEvidencia)
      }

      const res = await api.radicarPQRSFPublico(formData)
      if (res?.radicado) {
        setRadicadoGenerado(res.radicado)
        setFormPQRSF({
          nombre: '',
          email: '',
          telefono: '',
          tipo: 'Petición',
          ordenCodigo: '',
          descripcion: '',
        })
        setArchivoEvidencia(null)
      } else {
        setErrorRadicacion(res?.error || 'No se pudo radicar la solicitud.')
      }
    } catch (err) {
      setErrorRadicacion(err.message || 'Error de comunicación al radicar solicitud.')
    } finally {
      setCargandoRadicacion(false)
    }
  }

  // Manejar Consulta de Radicado
  const handleConsultarRadicado = async (e) => {
    e.preventDefault()
    setErrorRadicado('')
    setResultadoRadicado(null)
    if (!consultaRadicado.radicado.trim()) {
      setErrorRadicado('Por favor ingrese el número de radicado.')
      return
    }

    setCargandoRadicado(true)
    try {
      const res = await api.consultarPQRSFPublico({
        radicado: consultaRadicado.radicado.trim(),
        email: consultaRadicado.email.trim(),
      })
      if (res?.data) {
        setResultadoRadicado(res.data)
      } else {
        setErrorRadicado(res?.error || 'Radicado no encontrado.')
      }
    } catch (err) {
      setErrorRadicado(err.message || 'Error de conexión al consultar radicado.')
    } finally {
      setCargandoRadicado(false)
    }
  }

  const etapasInfo = [
    { num: 1, label: 'Diseño y Preprensa' },
    { num: 2, label: 'Aprobación del Arte' },
    { num: 3, label: 'Impresión' },
    { num: 4, label: 'Acabados y Confección' },
    { num: 5, label: 'Control de Calidad' },
    { num: 6, label: 'Empaque y Despacho' },
    { num: 7, label: 'Entregada' },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Barra superior de navegación institucional */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '20px',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
          }}>
            H
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '18px', color: '#0f172a', letterSpacing: '-0.3px' }}>
              Huellas Publicidad
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Portal de Atención al Cliente & Trazabilidad
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href="https://wa.me/573116088542?text=Hola,%20quisiera%20consultar%20sobre%20los%20servicios%20de%20Huellas%20Publicidad"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#22c55e',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(34, 197, 94, 0.25)',
            }}
          >
            <span>💬</span> WhatsApp Oficial
          </a>
          {onVolverLogin && (
            <button
              onClick={onVolverLogin}
              style={{
                padding: '8px 14px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Acceso Colaboradores (ORVEX)
            </button>
          )}
        </div>
      </header>

      {/* Banner de bienvenida */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff',
        padding: '40px 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
          }}>
            Servicio al Cliente Oficial
          </span>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '-0.5px' }}>
            Bienvenido al Centro de Atención y Seguimiento
          </h1>
          <p style={{ fontSize: '16px', color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
            Consulte en tiempo real el avance de su orden publicitaria en planta, radique solicitudes de soporte o presente quejas y garantías con respuesta garantizada.
          </p>
        </div>
      </section>

      {/* Selector de Pestañas */}
      <main style={{ maxWidth: '960px', margin: '-24px auto 40px auto', padding: '0 20px' }}>
        <div style={{
          display: 'flex',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
          gap: '6px',
          marginBottom: '24px',
        }}>
          <button
            onClick={() => setTabActiva('pedido')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: tabActiva === 'pedido' ? '#0284c7' : 'transparent',
              color: tabActiva === 'pedido' ? '#ffffff' : '#64748b',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📦</span> Consultar mi Pedido
          </button>
          <button
            onClick={() => setTabActiva('pqrsf')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: tabActiva === 'pqrsf' ? '#0284c7' : 'transparent',
              color: tabActiva === 'pqrsf' ? '#ffffff' : '#64748b',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📝</span> Radicar PQRSF / Garantía
          </button>
          <button
            onClick={() => setTabActiva('radicado')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: tabActiva === 'radicado' ? '#0284c7' : 'transparent',
              color: tabActiva === 'radicado' ? '#ffffff' : '#64748b',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🔍</span> Consultar Radicado
          </button>
        </div>

        {/* ============================================================== */}
        {/* PESTAÑA 1: CONSULTAR PEDIDO */}
        {/* ============================================================== */}
        {tabActiva === 'pedido' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '32px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
              Seguimiento de Orden de Producción
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
              Para proteger su privacidad y la información confidencial de su pedido, verifique su identidad ingresando el código de la orden y el número de teléfono, NIT o correo registrado.
            </p>

            <form onSubmit={handleConsultarPedido} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Código de la Orden *
                </label>
                <input
                  type="text"
                  placeholder="Ej: OP-2026-0001"
                  value={consultaPedido.codigo}
                  onChange={(e) => setConsultaPedido({ ...consultaPedido, codigo: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Dato de Validación (Teléfono, NIT o Correo) *
                </label>
                <input
                  type="text"
                  placeholder="Ej: 3116088542 o correo@empresa.com"
                  value={consultaPedido.contacto}
                  onChange={(e) => setConsultaPedido({ ...consultaPedido, contacto: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={cargandoPedido}
                  style={{
                    width: '100%',
                    padding: '11px 20px',
                    backgroundColor: cargandoPedido ? '#94a3b8' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: cargandoPedido ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  {cargandoPedido ? 'Consultando...' : 'Consultar Estado'}
                </button>
              </div>
            </form>

            {errorPedido && (
              <div style={{ marginTop: '20px', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                ⚠️ {errorPedido}
              </div>
            )}

            {/* Resultado de la orden */}
            {resultadoPedido && (
              <div style={{ marginTop: '32px', paddingTop: '28px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                      Orden Identificada
                    </span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '2px 0 0 0', color: '#0f172a' }}>
                      {resultadoPedido.codigo} — {resultadoPedido.producto}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      Cliente: <strong>{resultadoPedido.cliente}</strong> | Cantidad: {resultadoPedido.cantidad} unid.
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '6px 14px',
                      backgroundColor: resultadoPedido.etapa === 7 ? '#dcfce7' : '#e0f2fe',
                      color: resultadoPedido.etapa === 7 ? '#15803d' : '#0369a1',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 800,
                    }}>
                      Etapa: {resultadoPedido.etapaNombre} ({resultadoPedido.porcentajeAvance}%)
                    </div>
                    {resultadoPedido.fechaEntrega && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        Fecha estimada: <strong>{resultadoPedido.fechaEntrega}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stepper Visual de Etapas */}
                <div style={{ margin: '30px 0 20px 0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
                    {etapasInfo.map((et) => {
                      const pasada = et.num < resultadoPedido.etapa
                      const activa = et.num === resultadoPedido.etapa
                      return (
                        <div key={et.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: pasada ? '#22c55e' : (activa ? '#0284c7' : '#e2e8f0'),
                            color: pasada || activa ? '#ffffff' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800,
                            marginBottom: '6px',
                            boxShadow: activa ? '0 0 0 4px rgba(2, 132, 199, 0.2)' : 'none',
                          }}>
                            {pasada ? '✓' : et.num}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: activa ? 700 : 500, color: activa ? '#0284c7' : (pasada ? '#1e293b' : '#94a3b8'), lineHeight: 1.2 }}>
                            {et.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Especificaciones seguras de entrega */}
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Método de Entrega:</span>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{resultadoPedido.metodoEntrega || 'Por acordar'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Material:</span>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{resultadoPedido.material || 'Estándar'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Acabados:</span>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{resultadoPedido.acabados || 'Estándar'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Dirección de Despacho:</span>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{resultadoPedido.direccionEntrega || 'Sede principal'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 2: RADICAR PQRSF O GARANTÍA */}
        {/* ============================================================== */}
        {tabActiva === 'pqrsf' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '32px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
              Radicación de PQRSF y Solicitud de Garantía
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
              En Huellas Publicidad respaldamos cada uno de nuestros trabajos. Si presenta alguna novedad, solicitud de garantía o comentario, complete el formulario para asignarle un número de radicado oficial.
            </p>

            {radicadoGenerado ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#166534', margin: '0 0 6px 0' }}>
                  ¡Solicitud Radicada con Éxito!
                </h3>
                <p style={{ color: '#15803d', fontSize: '15px', margin: '0 0 20px 0' }}>
                  Su caso ha ingresado formalmente a nuestro equipo de Calidad y Postventa.
                </p>
                <div style={{
                  display: 'inline-block',
                  backgroundColor: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '2px dashed #22c55e',
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#15803d',
                  letterSpacing: '1px',
                  marginBottom: '20px',
                }}>
                  {radicadoGenerado}
                </div>
                <div>
                  <button
                    onClick={() => {
                      setConsultaRadicado({ radicado: radicadoGenerado, email: '' })
                      setTabActiva('radicado')
                      setRadicadoGenerado(null)
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#15803d',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Hacer Seguimiento a este Radicado
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRadicarPQRSF} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Tipo de Solicitud *
                  </label>
                  <select
                    value={formPQRSF.tipo}
                    onChange={(e) => setFormPQRSF({ ...formPQRSF, tipo: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Petición">Petición / Consulta Comercial</option>
                    <option value="Queja">Queja por Servicio</option>
                    <option value="Reclamo">Reclamo por Producto</option>
                    <option value="Garantía">Solicitud de Garantía / Falla Técnica</option>
                    <option value="Felicitación">Felicitación</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Nombre Completo o Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Inversiones ABC S.A.S."
                    value={formPQRSF.nombre}
                    onChange={(e) => setFormPQRSF({ ...formPQRSF, nombre: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Correo Electrónico de Contacto *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="correo@ejemplo.com"
                    value={formPQRSF.email}
                    onChange={(e) => setFormPQRSF({ ...formPQRSF, email: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Teléfono Celular
                  </label>
                  <input
                    type="tel"
                    placeholder="Ej: 311 608 8542"
                    value={formPQRSF.telefono}
                    onChange={(e) => setFormPQRSF({ ...formPQRSF, telefono: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Código de Orden (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: OP-2026-0001 (si aplica)"
                    value={formPQRSF.ordenCodigo}
                    onChange={(e) => setFormPQRSF({ ...formPQRSF, ordenCodigo: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Fotografía o Evidencia (Opcional)
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setArchivoEvidencia(e.target.files[0] || null)}
                    style={{ width: '100%', padding: '8px 0', fontSize: '13px', color: '#64748b' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Detalle de la Solicitud / Falla Reportada *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describa con precisión los hechos, medidas o novedades encontradas en su pedido..."
                    value={formPQRSF.descripcion}
                    onChange={(e) => setFormPQRSF({ ...formPQRSF, descripcion: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>

                {errorRadicacion && (
                  <div style={{ gridColumn: '1 / -1', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                    ⚠️ {errorRadicacion}
                  </div>
                )}

                <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
                  <button
                    type="submit"
                    disabled={cargandoRadicacion}
                    style={{
                      padding: '12px 28px',
                      backgroundColor: cargandoRadicacion ? '#94a3b8' : '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '15px',
                      cursor: cargandoRadicacion ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                    }}
                  >
                    {cargandoRadicacion ? 'Radicando...' : 'Radicar Solicitud Oficial'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 3: CONSULTAR RADICADO */}
        {/* ============================================================== */}
        {tabActiva === 'radicado' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '32px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
              Consulta de Estado de Radicado
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
              Verifique el estado del dictamen técnico, la asignación de responsable y la resolución de su radicado de PQRSF o Garantía.
            </p>

            <form onSubmit={handleConsultarRadicado} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Número de Radicado *
                </label>
                <input
                  type="text"
                  placeholder="Ej: RAD-2026-0001 o GAR-2026-0002"
                  value={consultaRadicado.radicado}
                  onChange={(e) => setConsultaRadicado({ ...consultaRadicado, radicado: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Correo Electrónico (Validación de seguridad)
                </label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={consultaRadicado.email}
                  onChange={(e) => setConsultaRadicado({ ...consultaRadicado, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={cargandoRadicado}
                  style={{
                    width: '100%',
                    padding: '11px 20px',
                    backgroundColor: cargandoRadicado ? '#94a3b8' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: cargandoRadicado ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cargandoRadicado ? 'Buscando...' : 'Buscar Radicado'}
                </button>
              </div>
            </form>

            {errorRadicado && (
              <div style={{ marginTop: '20px', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                ⚠️ {errorRadicado}
              </div>
            )}

            {/* Resultado del radicado */}
            {resultadoRadicado && (
              <div style={{ marginTop: '32px', paddingTop: '28px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                      {resultadoRadicado.categoria} — {resultadoRadicado.subtipo}
                    </span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '2px 0 0 0', color: '#0f172a' }}>
                      {resultadoRadicado.radicado}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      Fecha de Recepción: {resultadoRadicado.fecha} | Canal: {resultadoRadicado.canal}
                    </div>
                  </div>

                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '6px 14px',
                      backgroundColor: ['Solucionado', 'Resuelto', 'Cerrado'].includes(resultadoRadicado.estado) ? '#dcfce7' : '#fef3c7',
                      color: ['Solucionado', 'Resuelto', 'Cerrado'].includes(resultadoRadicado.estado) ? '#15803d' : '#b45309',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 800,
                    }}>
                      Estado: {resultadoRadicado.estado}
                    </span>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Descripción Radicada:
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                    {resultadoRadicado.descripcion}
                  </p>
                </div>

                {resultadoRadicado.respuestaCliente && (
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', color: '#166534', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                      Respuesta Oficial de Huellas Publicidad:
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#14532d', lineHeight: 1.5 }}>
                      {resultadoRadicado.respuestaCliente}
                    </p>
                    {resultadoRadicado.fechaSolucion && (
                      <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '8px' }}>
                        Resuelto el: {resultadoRadicado.fechaSolucion}
                      </div>
                    )}
                  </div>
                )}

                {/* Historial de Seguimiento */}
                {Array.isArray(resultadoRadicado.historial) && resultadoRadicado.historial.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', margin: '0 0 12px 0' }}>
                      Historial de Eventos del Caso
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {resultadoRadicado.historial.map((ev, idx) => (
                        <div key={idx} style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #0284c7', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>
                            <span>{ev.fecha} {ev.hora ? `(${ev.hora})` : ''}</span>
                            <span>{ev.autor}</span>
                          </div>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{ev.accion}</div>
                          {ev.detalle && <div style={{ color: '#475569', marginTop: '2px' }}>{ev.detalle}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Pie de página institucional */}
      <footer style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '24px 20px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#64748b',
      }}>
        <div>
          © {new Date().getFullYear()} <strong>Huellas Publicidad</strong> — Sistema ORVEX Enterprise. Todos los derechos reservados.
        </div>
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#94a3b8' }}>
          Atención telefónica & WhatsApp: +57 311 608 8542 | Cra 15 # 80-20, Bogotá / Medellín
        </div>
      </footer>
    </div>
  )
}
