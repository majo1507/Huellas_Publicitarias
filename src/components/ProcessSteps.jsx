import { ETAPAS } from '../data/mockData.js'
import Icon from './Icon.jsx'

const ICONOS_ETAPA = {
  Solicitud: 'inbox', Diseño: 'pen', Aprobación: 'check-circle', Impresión: 'printer',
  Acabados: 'scissors', Despacho: 'truck', Entrega: 'package', Postventa: 'life-buoy',
}
const NOMBRES_INTERNOS = { Solicitud: 'Recepción' }
const NOMBRES_CLIENTE = { Solicitud: 'Solicitud recibida', Entrega: 'Entregado' }

// Línea de tiempo del seguimiento: etapas terminadas, etapa actual y pendientes.
// "bloqueo" (opcional) marca con un candado la etapa que no se puede alcanzar todavía.
export default function ProcessSteps({ estado, modoCliente = false, bloqueo = false }) {
  const actual = ETAPAS.indexOf(estado)
  const etapas = modoCliente ? ETAPAS.slice(0, 7) : ETAPAS

  return (
    <ol className="steps">
      {etapas.map((etapa, i) => {
        const hecho = i < actual
        const enCurso = i === actual
        const clase = hecho ? 'terminada' : enCurso ? 'actual' : 'pendiente'
        const nombre = (modoCliente ? NOMBRES_CLIENTE : NOMBRES_INTERNOS)[etapa] || etapa
        const bloqueada = bloqueo && i === actual + 1
        return (
          <li key={etapa} className={`step ${clase}${bloqueada ? ' bloqueada' : ''}`} aria-current={enCurso ? 'step' : undefined}>
            <span className="step-circle">
              <Icon nombre={bloqueada ? 'lock' : hecho ? 'check' : ICONOS_ETAPA[etapa]} tamano={18} />
            </span>
            <span className="step-label">{nombre}</span>
            <span className="step-state">{hecho ? 'Completada' : enCurso ? 'En curso' : bloqueada ? 'Bloqueada' : 'Pendiente'}</span>
          </li>
        )
      })}
    </ol>
  )
}
