import { iniciales } from '../utils/format.js'

// Círculo con las iniciales de una persona
export default function Avatar({ nombre, tamano = 'md' }) {
  if (!nombre) return <span className={`avatar avatar-${tamano} avatar-vacio`}>?</span>
  return <span className={`avatar avatar-${tamano}`} title={nombre}>{iniciales(nombre)}</span>
}
