import { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import EmptyState from './EmptyState.jsx'

// Tabla reutilizable con buscador, filtros, orden por columnas y paginación.
//
// columnas : [{ clave, titulo, render?: (fila) => nodo, ordenar?: true, valor?: (fila) => valorParaOrdenar }]
// filas    : lista de registros
// buscar   : (fila) => texto donde se busca lo que escribe el usuario
// filtros  : [{ titulo: 'Estado', valor: (fila) => 'Diseño', opciones: ['Diseño', ...] }]
// tarjeta  : (fila) => nodo. Si se indica, aparece el botón para alternar entre tabla y tarjetas.
export default function DataTable({
  columnas, filas, buscar, filtros = [], porPagina = 8, tarjeta, acciones,
  vacioTitulo = 'No hay registros', vacioTexto = 'Prueba cambiando los filtros o la búsqueda.', placeholder = 'Buscar...',
}) {
  const [texto, setTexto] = useState('')
  const [valoresFiltro, setValoresFiltro] = useState({})
  const [orden, setOrden] = useState(null) // { clave, asc }
  const [pagina, setPagina] = useState(1)
  const [vista, setVista] = useState('tabla')

  const resultado = useMemo(() => {
    let lista = filas
    if (texto.trim() && buscar) {
      const q = texto.trim().toLowerCase()
      lista = lista.filter((f) => buscar(f).toLowerCase().includes(q))
    }
    filtros.forEach((f, i) => {
      const elegido = valoresFiltro[i]
      if (elegido) lista = lista.filter((fila) => String(f.valor(fila)) === elegido)
    })
    if (orden) {
      const col = columnas.find((c) => c.clave === orden.clave)
      const valor = (fila) => (col.valor ? col.valor(fila) : fila[col.clave])
      lista = [...lista].sort((a, b) => {
        const x = valor(a), y = valor(b)
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')
        return orden.asc ? r : -r
      })
    }
    return lista
  }, [filas, texto, valoresFiltro, orden, columnas, filtros, buscar])

  const totalPaginas = Math.max(1, Math.ceil(resultado.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = resultado.slice((paginaActual - 1) * porPagina, paginaActual * porPagina)
  const hayFiltros = texto || Object.values(valoresFiltro).some(Boolean)

  const cambiarOrden = (clave) => setOrden((o) => (o?.clave === clave ? { clave, asc: !o.asc } : { clave, asc: true }))
  const limpiar = () => { setTexto(''); setValoresFiltro({}); setPagina(1) }

  return (
    <div className="card table-card">
      <div className="toolbar">
        {buscar && (
          <label className="search-box">
            <Icon nombre="search" tamano={16} />
            <input
              type="search"
              placeholder={placeholder}
              value={texto}
              onChange={(e) => { setTexto(e.target.value); setPagina(1) }}
              aria-label="Buscar en la lista"
            />
          </label>
        )}
        {filtros.map((f, i) => (
          <select
            key={f.titulo}
            className="filter-select"
            value={valoresFiltro[i] || ''}
            aria-label={f.titulo}
            onChange={(e) => { setValoresFiltro({ ...valoresFiltro, [i]: e.target.value }); setPagina(1) }}
          >
            <option value="">{f.titulo}: todos</option>
            {f.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {hayFiltros && <button className="btn btn-ghost btn-sm" onClick={limpiar}>Limpiar filtros</button>}
        <span className="toolbar-spacer" />
        <span className="toolbar-count">{resultado.length} {resultado.length === 1 ? 'resultado' : 'resultados'}</span>
        {acciones}
        {tarjeta && (
          <div className="view-toggle" role="group" aria-label="Tipo de vista">
            <button className={vista === 'tabla' ? 'active' : ''} onClick={() => setVista('tabla')} aria-label="Vista de tabla"><Icon nombre="list2" tamano={16} /></button>
            <button className={vista === 'tarjetas' ? 'active' : ''} onClick={() => setVista('tarjetas')} aria-label="Vista de tarjetas"><Icon nombre="grid" tamano={16} /></button>
          </div>
        )}
      </div>

      {resultado.length === 0 ? (
        <EmptyState
          icono="search"
          titulo={vacioTitulo}
          texto={vacioTexto}
          accion={hayFiltros && <button className="btn btn-sm" onClick={limpiar}>Limpiar filtros</button>}
        />
      ) : vista === 'tarjetas' && tarjeta ? (
        <div className="card-grid">{visibles.map((f) => <div key={f.id}>{tarjeta(f)}</div>)}</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columnas.map((c) => (
                  <th key={c.clave} className={c.ordenar ? 'sortable' : ''} onClick={c.ordenar ? () => cambiarOrden(c.clave) : undefined}>
                    {c.titulo}
                    {c.ordenar && orden?.clave === c.clave && <Icon nombre={orden.asc ? 'chevron-down' : 'chevron-right'} tamano={12} className="sort-icon" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => (
                <tr key={fila.id}>
                  {columnas.map((c) => <td key={c.clave}>{c.render ? c.render(fila) : fila[c.clave]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultado.length > porPagina && (
        <div className="pagination">
          <span>Página {paginaActual} de {totalPaginas}</span>
          <div className="pagination-buttons">
            <button className="btn btn-sm" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
              <Icon nombre="chevron-left" tamano={14} /> Anterior
            </button>
            <button className="btn btn-sm" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
              Siguiente <Icon nombre="chevron-right" tamano={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
