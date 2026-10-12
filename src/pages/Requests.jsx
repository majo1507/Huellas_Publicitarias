import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import Alert from '../components/Alert.jsx'
import Icon from '../components/Icon.jsx'
import { formatoCOP } from '../utils/format.js'

const ESTADOS = ['Pendiente', 'En validación', 'Aprobada', 'Rechazada']

// Solicitudes de clientes.
// Comercial: las envía a validación. Coordinador: las valida (genera la orden) o las rechaza.
export default function Requests({ data, actions, irA, role }) {
  const [rechazando, setRechazando] = useState(null) // id de la solicitud a rechazar
  const [validando, setValidando] = useState(null) // id de la solicitud a validar

  const esCoordinador = role === 'coordinador'
  const porValidar = data.requests.filter((s) => s.estado === 'En validación').length
  const porEnviar = data.requests.filter((s) => s.estado === 'Pendiente').length

  const columnas = [
    { clave: 'id', titulo: 'Solicitud', ordenar: true, render: (s) => <strong>{s.id}</strong> },
    { clave: 'cliente', titulo: 'Cliente', ordenar: true },
    { clave: 'producto', titulo: 'Producto', render: (s) => <>{s.producto}<small className="cell-sub">{s.cantidad} uds · {s.dimensiones}</small></> },
    { clave: 'presupuesto', titulo: 'Presupuesto', ordenar: true, render: (s) => formatoCOP(s.presupuesto) },
    { clave: 'fechaEntrega', titulo: 'Entrega' },
    {
      clave: 'estado', titulo: 'Estado',
      render: (s) => (
        <>
          <StatusBadge estado={s.estado} />
          {s.motivoRechazo && <small className="cell-sub text-rojo">{s.motivoRechazo}</small>}
        </>
      ),
    },
    {
      clave: 'acciones', titulo: 'Acciones',
      render: (s) => (
        <div className="row-actions">
          {role === 'comercial' && s.estado === 'Pendiente' && (
            <button className="btn btn-primary btn-sm" onClick={() => actions.sendToValidation(s.id)}><Icon nombre="send" tamano={14} /> Enviar a validación</button>
          )}
          {esCoordinador && s.estado === 'En validación' && (
            <>
              <button className="btn btn-success btn-sm" onClick={() => setValidando(s.id)}><Icon nombre="check" tamano={14} /> Validar</button>
              <button className="btn btn-danger btn-sm" onClick={() => setRechazando(s.id)}>Rechazar</button>
            </>
          )}
          {s.ordenId && <button className="btn btn-soft btn-sm" onClick={() => irA('detalle', s.ordenId)}><Icon nombre="eye" tamano={14} /> Ver {s.ordenId.slice(-4)}</button>}
          {!s.ordenId && !(role === 'comercial' && s.estado === 'Pendiente') && !(esCoordinador && s.estado === 'En validación') && <span className="muted">—</span>}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo={esCoordinador ? 'Validar solicitudes' : 'Solicitudes'}
        subtitulo={esCoordinador ? 'Valida la información y genera la orden de producción.' : 'Solicitudes de clientes y su estado de validación.'}
        icono="inbox"
        acciones={role === 'comercial' && <button className="btn btn-primary" onClick={() => irA('nuevo')}><Icon nombre="plus" tamano={16} /> Registrar solicitud</button>}
      />

      {esCoordinador && porValidar > 0 && <Alert tipo="aviso" titulo={`${porValidar} solicitud(es) esperan tu validación`}>Al validarlas se generará la orden de producción y se asignará a diseño.</Alert>}
      {role === 'comercial' && porEnviar > 0 && <Alert tipo="info" titulo={`${porEnviar} solicitud(es) pendientes`}>Envíalas a validación para que el coordinador las revise.</Alert>}

      <DataTable
        columnas={columnas}
        filas={data.requests}
        porPagina={8}
        buscar={(s) => `${s.id} ${s.cliente} ${s.producto}`}
        placeholder="Buscar por solicitud, cliente o producto..."
        filtros={[
          { titulo: 'Estado', valor: (s) => s.estado, opciones: ESTADOS },
          { titulo: 'Cliente', valor: (s) => s.cliente, opciones: [...new Set(data.requests.map((s) => s.cliente))] },
        ]}
        vacioTitulo="No hay solicitudes con esos filtros"
      />

      {validando && (
        <Modal
          titulo="Validar solicitud" subtitulo={validando} icono="check-circle" tipoBoton="success"
          mensaje="Se generará una orden de producción nueva, quedará asignada a diseño y se registrará en el historial. ¿Deseas continuar?"
          textoBoton="Validar y generar orden"
          onClose={() => setValidando(null)}
          onConfirm={() => { actions.validateRequest(validando); setValidando(null) }}
        />
      )}

      {rechazando && (
        <Modal
          titulo="Rechazar solicitud" subtitulo={rechazando} icono="x-circle" tipoBoton="danger"
          etiqueta="Motivo del rechazo" ayuda="El área comercial verá este motivo." minimo={10}
          textoBoton="Rechazar solicitud"
          onClose={() => setRechazando(null)}
          onConfirm={(motivo) => { actions.rejectRequest(rechazando, motivo); setRechazando(null) }}
        />
      )}
    </div>
  )
}
