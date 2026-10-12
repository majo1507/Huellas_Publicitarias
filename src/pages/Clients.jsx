import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'

// Lista de clientes (la usa Comercial / Recepción)
export default function Clients({ data, irA }) {
  const filas = data.clients.map((c) => ({
    ...c,
    solicitudes: data.requests.filter((s) => s.clienteId === c.id).length,
    ordenes: data.orders.filter((o) => o.clienteId === c.id).length,
  }))

  const columnas = [
    { clave: 'nombre', titulo: 'Cliente', ordenar: true, render: (c) => <span className="person"><Avatar nombre={c.nombre} tamano="sm" /><strong>{c.nombre}</strong></span> },
    { clave: 'contacto', titulo: 'Contacto', render: (c) => <>{c.contacto}<small className="cell-sub">{c.correo}</small></> },
    { clave: 'telefono', titulo: 'Teléfono' },
    { clave: 'ciudad', titulo: 'Ciudad', ordenar: true },
    { clave: 'solicitudes', titulo: 'Solicitudes', ordenar: true },
    { clave: 'ordenes', titulo: 'Órdenes', ordenar: true },
    { clave: 'acciones', titulo: 'Acciones', render: () => <button className="btn btn-soft btn-sm" onClick={() => irA('nuevo')}><Icon nombre="file-plus" tamano={14} /> Nueva solicitud</button> },
  ]

  return (
    <div>
      <PageHeader titulo="Clientes" subtitulo={`${data.clients.length} clientes registrados.`} icono="users" />
      <DataTable
        columnas={columnas}
        filas={filas}
        buscar={(c) => `${c.nombre} ${c.contacto} ${c.correo} ${c.ciudad}`}
        placeholder="Buscar cliente, contacto o ciudad..."
        filtros={[{ titulo: 'Ciudad', valor: (c) => c.ciudad, opciones: [...new Set(data.clients.map((c) => c.ciudad))] }]}
        vacioTitulo="No se encontraron clientes"
      />
    </div>
  )
}
