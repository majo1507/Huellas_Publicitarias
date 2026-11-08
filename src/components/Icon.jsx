// Sistema de iconografía vectorial de ORVEX
// Fase Piloto: Estilo "Notdog Solid" (sólido, redondeado, expresivo, 2D plano con filete especular sutil)
// aplicado en Sidebar, Header, Dashboards y componentes compartidos, conservando las 19 micro-animaciones semánticas.

const NOTDOG_SOLID_PILOT = {
  // Inicio / Casa sólida redondeada con puerta en negativo y filete Notdog en el tejado
  home: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M10.42 2.62a2.4 2.4 0 0 1 3.16 0l7.5 6.62c.6.53.92 1.29.92 2.09v7.47A2.7 2.7 0 0 1 19.3 21.5H4.7A2.7 2.7 0 0 1 2 18.8v-7.47c0-.8.32-1.56.92-2.09l7.5-6.62ZM9.75 14a1.25 1.25 0 0 0-1.25 1.25v4.25h7v-4.25A1.25 1.25 0 0 0 14.25 14h-4.5Z"
      />
      <path
        className="nd-highlight"
        d="M4.6 10.6 11.4 4.6"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </>
  ),

  // Órdenes / Portapapeles sólido redondeado con líneas en negativo y pinza superior animada
  clipboard: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M6.5 4.5A2.5 2.5 0 0 0 4 7v12a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V7a2.5 2.5 0 0 0-2.5-2.5H16v1a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1H6.5Zm1.75 6.25a1 1 0 0 1 1-1h5.5a1 1 0 1 1 0 2h-5.5a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h3.5a1 1 0 1 1 0 2h-3.5a1 1 0 0 1-1-1Z"
      />
      <rect
        className="nd-body icon-part-detail"
        x="8.5"
        y="2"
        width="7"
        height="4.2"
        rx="1.8"
        fill="currentColor"
      />
      <path
        className="nd-highlight"
        d="M6.2 7.4v6.2"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Solicitudes / Bandeja sólida redondeada con flecha/indicador de entrada
  inbox: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M4.82 4.9A2.6 2.6 0 0 1 7.2 3.3h9.6a2.6 2.6 0 0 1 2.38 1.6l2.42 5.75c.26.62.4 1.29.4 1.96v5.19a2.7 2.7 0 0 1-2.7 2.7H4.7A2.7 2.7 0 0 1 2 17.8v-5.19c0-.67.14-1.34.4-1.96L4.82 4.9Zm2.38.6L5.1 10.6h3.25a1.2 1.2 0 0 1 1.07.66l.56 1.12a.8.8 0 0 0 .72.44h2.6a.8.8 0 0 0 .72-.44l.56-1.12a1.2 1.2 0 0 1 1.07-.66h3.25L16.8 5.5H7.2Z"
      />
      <path
        className="nd-highlight icon-part-detail"
        d="M7.8 5.6h5.2"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Clientes / Grupo de usuarios sólidos redondeados
  users: (
    <>
      <circle className="nd-body icon-part-primary" cx="9" cy="7.5" r="4" fill="currentColor" />
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        d="M2 18.2C2 15.33 4.69 13 8 13h2c3.31 0 6 2.33 6 5.2v.8a1.8 1.8 0 0 1-1.8 1.8H3.8A1.8 1.8 0 0 1 2 19v-.8Z"
      />
      <g className="icon-part-detail">
        <path
          className="nd-body"
          fill="currentColor"
          d="M16.2 4.1a3.4 3.4 0 0 1 0 6.62 4.9 4.9 0 0 0 0-6.62ZM17.4 13.3c2.65.42 4.6 2.38 4.6 4.78v.92a1.5 1.5 0 0 1-1.5 1.5h-2.6v-1.7c0-2.1-.78-3.98-2.1-5.22.52-.18 1.05-.28 1.6-.28Z"
        />
      </g>
      <path
        className="nd-highlight"
        d="M6.8 5.8a2.3 2.3 0 0 1 2.2-1.1"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),

  // Usuario individual (Header / Rol — inspirado en fila 5 col 1 de la referencia Notdog)
  user: (
    <>
      <circle className="nd-body icon-part-detail" cx="12" cy="7.5" r="4.1" fill="currentColor" />
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        d="M4 18.4C4 15.42 7.13 13 11 13h2c3.87 0 7 2.42 7 5.4v.7a1.9 1.9 0 0 1-1.9 1.9H5.9A1.9 1.9 0 0 1 4 19.1v-.7Z"
      />
      <path
        className="nd-highlight"
        d="M9.7 5.7a2.4 2.4 0 0 1 2.3-1.1"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),

  // Registrar solicitud / Documento sólido redondeado con signo +
  'file-plus': (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M6.5 2.5A2.5 2.5 0 0 0 4 5v14a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V8.83a2.5 2.5 0 0 0-.73-1.77l-3.83-3.83a2.5 2.5 0 0 0-1.77-.73H6.5ZM12 9.75a1.1 1.1 0 0 1 1.1 1.1v1.8h1.8a1.1 1.1 0 1 1 0 2.2h-1.8v1.8a1.1 1.1 0 1 1-2.2 0v-1.8H9.1a1.1 1.1 0 1 1 0-2.2h1.8v-1.8a1.1 1.1 0 0 1 1.1-1.1Z"
      />
      <path
        className="nd-highlight"
        d="M6.3 5.4v6.5"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Comunicaciones / Burbuja sólida redondeada expresiva
  message: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M5.5 3.5A3 3 0 0 0 2.5 6.5v7.5a3 3 0 0 0 3 3h1.7v2.75a1.25 1.25 0 0 0 2.08.93L13.1 17h5.4a3 3 0 0 0 3-3V6.5a3 3 0 0 0-3-3h-13Zm2.25 5a1 1 0 0 1 1-1h6.5a1 1 0 1 1 0 2h-6.5a1 1 0 0 1-1-1Zm0 3.5a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1Z"
      />
      <path
        className="nd-highlight"
        d="M5.2 5.6h5.5"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Entregas / Camión sólido redondeado con ruedas animadas
  truck: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M3.5 4.5A2.2 2.2 0 0 0 1.3 6.7v8.1c0 1.1.9 2 2 2h.45a3.45 3.45 0 0 1 6.5 0h4.5a3.45 3.45 0 0 1 6.5 0h.25a1.5 1.5 0 0 0 1.5-1.5v-3.55a2.4 2.4 0 0 0-.62-1.61l-2.66-2.95a2.4 2.4 0 0 0-1.78-.79H15.5V6.7a2.2 2.2 0 0 0-2.2-2.2H3.5Zm12 3.8v3.2h4.4l-1.82-2.02a.8.8 0 0 0-.6-.26H15.5v-.92Z"
      />
      <circle className="nd-body icon-part-detail" cx="7" cy="17.5" r="2.4" fill="currentColor" />
      <circle className="nd-body icon-part-detail" cx="18" cy="17.5" r="2.4" fill="currentColor" />
      <path
        className="nd-highlight"
        d="M3.6 6.6h6.4"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Tablero de producción / Columnas Kanban sólidas redondeadas
  columns: (
    <>
      <rect className="nd-body icon-part-primary" x="2.5" y="3.5" width="5.4" height="17" rx="2.1" fill="currentColor" />
      <rect className="nd-body icon-part-detail" x="9.3" y="3.5" width="5.4" height="13.5" rx="2.1" fill="currentColor" />
      <rect className="nd-body icon-part-primary" x="16.1" y="3.5" width="5.4" height="17" rx="2.1" fill="currentColor" />
      <path
        className="nd-highlight"
        d="M4.3 5.8v5.5M11.1 5.8v4.2M17.9 5.8v5.5"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),

  // Actividades / Lista sólida redondeada (inspirada en fila 1 col 6 y fila 4 col 1 de Notdog Solid)
  list: (
    <>
      <circle className="nd-body icon-part-detail" cx="4.5" cy="6.2" r="2" fill="currentColor" />
      <circle className="nd-body icon-part-detail" cx="4.5" cy="12" r="2" fill="currentColor" />
      <circle className="nd-body icon-part-detail" cx="4.5" cy="17.8" r="2" fill="currentColor" />
      <rect className="nd-body icon-part-primary" x="8.5" y="4.5" width="13" height="3.4" rx="1.7" fill="currentColor" />
      <rect className="nd-body icon-part-primary" x="8.5" y="10.3" width="10.5" height="3.4" rx="1.7" fill="currentColor" />
      <rect className="nd-body icon-part-primary" x="8.5" y="16.1" width="13" height="3.4" rx="1.7" fill="currentColor" />
      <path
        className="nd-highlight"
        d="M10.2 5.7h5.5M10.2 11.5h4.2"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </>
  ),

  // Inventario / Caja sólida redondeada con división geométrica
  package: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M10.75 2.42a2.6 2.6 0 0 1 2.5 0l7.1 3.94c.83.46 1.35 1.34 1.35 2.3v6.68c0 .96-.52 1.84-1.35 2.3l-7.1 3.94a2.6 2.6 0 0 1-2.5 0l-7.1-3.94A2.63 2.63 0 0 1 2.3 15.34V8.66c0-.96.52-1.84 1.35-2.3l7.1-3.94ZM5.4 7.7 12 11.25 18.6 7.7l-2.3-1.28-6.45 3.48a.75.75 0 0 1-.71-1.32l6.33-3.41-2.97-1.65a.9.9 0 0 0-.88 0L5.4 7.7Zm5.75 5.15v6.4l-6.6-3.66V9.25l6.6 3.6Z"
      />
      <path
        className="nd-highlight icon-part-detail"
        d="M6.2 6.8 11.5 3.9"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),

  // Diseño / Lápiz-pluma sólida redondeada (inspirada en fila 2 col 2 de la referencia Notdog Solid)
  pen: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        d="M16.24 3.56a2.9 2.9 0 0 1 4.1 4.1l-1.18 1.18-4.1-4.1 1.18-1.18ZM13.65 6.15l4.1 4.1-8.35 8.35a2.4 2.4 0 0 1-1.18.64l-3.92.88a1.1 1.1 0 0 1-1.31-1.31l.88-3.92c.1-.45.32-.86.64-1.18l8.35-8.35Z"
      />
      <path
        className="nd-highlight icon-part-detail"
        d="M7.2 14.3 14.1 7.4"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Postventa / Salvavidas sólido redondeado
  'life-buoy': (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3.6 4.74a6.2 6.2 0 0 1 7.2 0l-1.64 2.3a3.7 3.7 0 0 0-3.92 0l-1.64-2.3Zm8.86 1.66a6.2 6.2 0 0 1 0 7.2l-2.3-1.64a3.7 3.7 0 0 0 0-3.92l2.3-1.64Zm-1.66 8.86a6.2 6.2 0 0 1-7.2 0l1.64-2.3a3.7 3.7 0 0 0 3.92 0l1.64 2.3ZM6.74 15.6a6.2 6.2 0 0 1 0-7.2l2.3 1.64a3.7 3.7 0 0 0 0 3.92l-2.3 1.64Z"
      />
      <path
        className="nd-highlight"
        d="M6.4 6.4A7.8 7.8 0 0 1 11.5 4"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Reportes / Barras sólidas redondeadas tipo cápsula
  'bar-chart': (
    <>
      <rect className="nd-body icon-part-primary" x="3.5" y="12" width="4.4" height="8.5" rx="2.2" fill="currentColor" />
      <rect className="nd-body icon-part-detail" x="9.8" y="7.5" width="4.4" height="13" rx="2.2" fill="currentColor" />
      <rect className="nd-body icon-part-secondary" x="16.1" y="3.5" width="4.4" height="17" rx="2.2" fill="currentColor" />
      <path
        className="nd-highlight"
        d="M5.2 14v3.5M11.5 9.5v5M17.8 5.5v6.5"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),

  // Usuarios / Escudo sólido redondeado con check interno
  shield: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M11.18 2.25a2.3 2.3 0 0 1 1.64 0l6.6 2.54A2.3 2.3 0 0 1 20.9 6.9v5.1c0 5.15-3.58 8.63-8.08 10.22a2.4 2.4 0 0 1-1.64 0C6.68 20.63 3.1 17.15 3.1 12V6.9a2.3 2.3 0 0 1 1.48-2.11l6.6-2.54Zm4.03 7.46a1.1 1.1 0 0 0-1.56-1.56L11 10.8l-1.15-1.15a1.1 1.1 0 0 0-1.56 1.56l1.93 1.93a1.1 1.1 0 0 0 1.56 0l3.43-3.43Z"
      />
      <path
        className="nd-highlight"
        d="M5.5 7.2v3.8"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),

  // Producción / Impresora sólida redondeada con hoja animada
  printer: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M7 2.5A2 2 0 0 0 5 4.5V7h14V4.5a2 2 0 0 0-2-2H7ZM4.5 8.5A2.5 2.5 0 0 0 2 11v5a2.5 2.5 0 0 0 2.5 2.5H6v-3a1.5 1.5 0 0 1 1.5-1.5h9a1.5 1.5 0 0 1 1.5 1.5v3h1.5A2.5 2.5 0 0 0 22 16v-5a2.5 2.5 0 0 0-2.5-2.5h-15Zm13 3.75a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3Z"
      />
      <rect
        className="nd-body icon-part-detail"
        x="7.2"
        y="15"
        width="9.6"
        height="6.5"
        rx="1.6"
        fill="currentColor"
      />
      <path
        className="nd-highlight"
        d="M4.5 10.4h5.5"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),

  // Reloj / Plazos sólido redondeado con manecilla animada
  clock: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm1.1 5.25a1.1 1.1 0 1 0-2.2 0v4.6c0 .4.22.77.57.96l3.2 1.75a1.1 1.1 0 1 0 1.06-1.92L13.1 11.4V7.5Z"
      />
      <path
        className="nd-highlight icon-part-detail"
        d="M6.2 6.5A7.6 7.6 0 0 1 11.2 4.3"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Alerta / Triángulo sólido redondeado
  'alert-triangle': (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M9.86 3.58a2.48 2.48 0 0 1 4.28 0l7.52 13.02a2.48 2.48 0 0 1-2.14 3.72H4.48a2.48 2.48 0 0 1-2.14-3.72L9.86 3.58ZM12 8.2a1.15 1.15 0 0 1 1.15 1.15v3.6a1.15 1.15 0 1 1-2.3 0v-3.6A1.15 1.15 0 0 1 12 8.2Zm0 8.55a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      />
      <path
        className="nd-highlight"
        d="M5.4 15.8 9.6 8.4"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),

  // Círculo de alerta sólido redondeado
  'alert-circle': (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM12 7a1.15 1.15 0 0 1 1.15 1.15v4.2a1.15 1.15 0 1 1-2.3 0v-4.2A1.15 1.15 0 0 1 12 7Zm0 9.6a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      />
      <path
        className="nd-highlight"
        d="M6.2 6.5A7.6 7.6 0 0 1 11.2 4.3"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Información sólida redondeada
  info: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm0 6.8a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm1.15 2.45a1.15 1.15 0 1 0-2.3 0v4.8a1.15 1.15 0 1 0 2.3 0v-4.8Z"
      />
      <path
        className="nd-highlight"
        d="M6.2 6.5A7.6 7.6 0 0 1 11.2 4.3"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Check-circle sólido redondeado
  'check-circle': (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm4.58 7.68a1.15 1.15 0 0 0-1.66-1.6l-4.12 4.28-1.72-1.72a1.15 1.15 0 0 0-1.62 1.62l2.55 2.55a1.15 1.15 0 0 0 1.64-.02l4.93-5.11Z"
      />
      <path
        className="nd-highlight"
        d="M6.2 6.5A7.6 7.6 0 0 1 11.2 4.3"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Check Notdog Solid (inspirado en fila 4 col 6 de la referencia)
  check: (
    <>
      <path
        className="nd-stroke icon-part-primary"
        d="M4.5 12.5 9.6 17.5 19.5 6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="nd-highlight"
        d="M10.2 15.8 18.2 7.2"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </>
  ),

  // X-circle sólido redondeado
  'x-circle': (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM9.7 8.1a1.1 1.1 0 0 0-1.56 1.56L10.44 12l-2.3 2.34a1.1 1.1 0 1 0 1.56 1.56L12 13.56l2.3 2.34a1.1 1.1 0 1 0 1.56-1.56L13.56 12l2.3-2.34A1.1 1.1 0 1 0 14.3 8.1L12 10.44 9.7 8.1Z"
      />
      <path
        className="nd-highlight"
        d="M6.2 6.5A7.6 7.6 0 0 1 11.2 4.3"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Notificaciones / Campana sólida redondeada
  bell: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        d="M12 2.2a1.6 1.6 0 0 1 1.55 1.22A6.8 6.8 0 0 1 18.8 10v3.35l1.32 1.98A1.45 1.45 0 0 1 18.9 17.6H5.1a1.45 1.45 0 0 1-1.22-2.27L5.2 13.35V10a6.8 6.8 0 0 1 5.25-6.58A1.6 1.6 0 0 1 12 2.2Z"
      />
      <path
        className="nd-body icon-part-detail"
        fill="currentColor"
        d="M9.25 19h5.5a2.75 2.75 0 0 1-5.5 0Z"
      />
      <path
        className="nd-highlight"
        d="M7.5 9.8a4.6 4.6 0 0 1 3.2-4.2"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),

  // Buscador / Lupa gruesa redondeada Notdog
  search: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        fillRule="evenodd"
        d="M10.8 2.8a8 8 0 1 0 4.88 14.34l3.54 3.54a1.75 1.75 0 0 0 2.47-2.47l-3.54-3.54A8 8 0 0 0 10.8 2.8Zm-4.6 8a4.6 4.6 0 1 1 9.2 0 4.6 4.6 0 0 1-9.2 0Z"
      />
      <path
        className="nd-highlight"
        d="M7.2 6.8a5.2 5.2 0 0 1 3.6-1.4"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),

  // Signo Más Notdog Solid (inspirado directamente en fila 1 col 1 de la referencia)
  plus: (
    <>
      <path
        className="nd-stroke icon-part-primary"
        d="M12 4.5v15M4.5 12h15"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        className="nd-highlight"
        d="M12 5.8v4.2M6 12h4"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </>
  ),

  // Enviar / Avión sólido redondeado
  send: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        d="M20.92 3.08a1.65 1.65 0 0 0-1.74-.34L3.4 9.18a1.65 1.65 0 0 0-.08 3.03l5.26 2.34 5.28-5.28a.95.95 0 1 1 1.34 1.34l-5.28 5.28 2.34 5.26a1.65 1.65 0 0 0 3.03-.08l6.44-15.78a1.65 1.65 0 0 0-.81-2.21Z"
      />
      <path
        className="nd-highlight"
        d="M6.4 10.4 16.8 6.1"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),

  // Descargar Notdog Solid (inspirado directamente en fila 1 col 8 y fila 2 col 5 de la referencia)
  download: (
    <>
      <g className="icon-part-detail">
        <path
          className="nd-stroke"
          d="M12 3.8v10.2m0 0-4.2-4.2M12 14l4.2-4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        className="nd-stroke icon-part-primary"
        d="M4.2 16.5v1.6A2.2 2.2 0 0 0 6.4 20.3h11.2a2.2 2.2 0 0 0 2.2-2.2v-1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <path
        className="nd-highlight"
        d="M7.2 20.3h7.5"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </>
  ),

  // Accesos rápidos / Capas sólidas redondeadas
  layers: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        d="M11.12 2.48a2 2 0 0 1 1.76 0l8 4a1.6 1.6 0 0 1 0 2.86l-8 4a2 2 0 0 1-1.76 0l-8-4a1.6 1.6 0 0 1 0-2.86l8-4Z"
      />
      <path
        className="nd-stroke icon-part-detail"
        d="m3.8 12.8 8.2 4.1 8.2-4.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="nd-stroke icon-part-secondary"
        d="m3.8 17.2 8.2 4.1 8.2-4.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="nd-highlight"
        d="M6.4 7.4 11.6 4.8"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),

  // Actividad reciente / Pulso redondeado expresivo
  activity: (
    <>
      <path
        className="nd-stroke icon-part-primary"
        d="M2.8 12h3.4l2.6-6.8 5.2 13.6 2.8-6.8h4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="nd-highlight"
        d="M6.8 10.5 8.8 5.4"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </>
  ),

  // Cerrar sesión / Salida Notdog Solid (inspirado en fila 3 col 1 y fila 5 col 5 de la referencia)
  'log-out': (
    <>
      <path
        className="nd-stroke icon-part-primary"
        d="M9.5 4.2H6.4A2.4 2.4 0 0 0 4 6.6v10.8a2.4 2.4 0 0 0 2.4 2.4h3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <g className="icon-part-detail">
        <path
          className="nd-stroke"
          d="M10.5 12h9.5m0 0-3.6-3.6M20 12l-3.6 3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        className="nd-highlight"
        d="M4 8.2v6.5"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </>
  ),

  // Menú lateral hamburguesa redondeado Notdog Solid
  menu: (
    <>
      <rect className="nd-body icon-part-primary" x="3" y="4.5" width="18" height="3.2" rx="1.6" fill="currentColor" />
      <rect className="nd-body icon-part-detail" x="3" y="10.4" width="14" height="3.2" rx="1.6" fill="currentColor" />
      <rect className="nd-body icon-part-primary" x="3" y="16.3" width="18" height="3.2" rx="1.6" fill="currentColor" />
      <path
        className="nd-highlight"
        d="M5 5.6h7M5 11.5h5"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </>
  ),

  // Sol Notdog Solid (inspirado directamente en fila 5 col 6 de la referencia)
  sun: (
    <>
      <circle className="nd-body icon-part-primary" cx="12" cy="12" r="4.6" fill="currentColor" />
      <path
        className="nd-stroke icon-part-detail"
        d="M12 2.5v2.1M12 19.4v2.1M4.93 4.93l1.48 1.48M17.59 17.59l1.48 1.48M2.5 12h2.1M19.4 12h2.1M4.93 19.07l1.48-1.48M17.59 6.41l1.48-1.48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        className="nd-highlight"
        d="M9.6 9.8a2.8 2.8 0 0 1 2.4-1.2"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),

  // Luna creciente sólida redondeada Notdog
  moon: (
    <>
      <path
        className="nd-body icon-part-primary"
        fill="currentColor"
        d="M20.35 14.28a1.2 1.2 0 0 0-1.42-.3 7.2 7.2 0 0 1-8.91-8.91 1.2 1.2 0 0 0-1.57-1.48A9.5 9.5 0 1 0 20.65 15.55a1.2 1.2 0 0 0-.3-1.27Z"
      />
      <path
        className="nd-highlight"
        d="M6.4 9.2a6.8 6.8 0 0 0 3.2 7.2"
        fill="none"
        stroke="var(--nd-hi)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </>
  ),
}

// Resto del catálogo para módulos aún no migrados en la prueba piloto
const ICONOS = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect className="icon-part-secondary" x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect className="icon-part-secondary" x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line className="icon-part-secondary" x1="3" y1="9" x2="21" y2="9" />
      <line className="icon-part-secondary" x1="9" y1="21" x2="9" y2="9" />
    </>
  ),
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path className="icon-part-secondary" d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  'chevron-right': <polyline points="9 18 15 12 9 6" />,
  'chevron-left': <polyline points="15 18 9 12 15 6" />,
  'chevron-down': <polyline points="6 9 12 15 18 9" />,
  'chevron-up': <polyline points="18 15 12 9 6 15" />,
  'arrow-right': (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  'arrow-left': (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
  ),
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle className="icon-part-secondary" cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path className="icon-part-secondary" d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  'message-circle': (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  ),
  scissors: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line className="icon-part-secondary" x1="14.47" y1="14.48" x2="20" y2="20" />
      <line className="icon-part-secondary" x1="8.12" y1="8.12" x2="12" y2="12" />
    </>
  ),
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line className="icon-part-secondary" x1="16" y1="2" x2="16" y2="6" />
      <line className="icon-part-secondary" x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  'trending-up': (
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline className="icon-part-secondary" points="17 6 23 6 23 12" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path className="icon-part-secondary" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  edit: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path className="icon-part-secondary" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>
  ),
  play: <polygon points="5 3 19 12 5 21 5 3" />,
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect className="icon-part-secondary" x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
  flag: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line className="icon-part-secondary" x1="4" y1="22" x2="4" y2="15" />
    </>
  ),
  filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle className="icon-part-secondary" cx="8.5" cy="8.5" r="1.5" />
      <polyline className="icon-part-detail" points="21 15 16 10 5 21" />
    </>
  ),
  refresh: (
    <>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle className="icon-part-secondary" cx="12" cy="10" r="3" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line className="icon-part-secondary" x1="16" y1="13" x2="8" y2="13" />
      <line className="icon-part-secondary" x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  list2: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.2" />
      <rect className="icon-part-secondary" x="3" y="13" width="18" height="5" rx="1.2" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline className="icon-part-secondary" points="17 8 12 3 7 8" />
      <line className="icon-part-secondary" x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  paperclip: (
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  ),
}

// Iconos secundarios de acción oficiales Font Awesome Free (Solid SVG)
// Licencia CC BY 4.0 / SIL OFL - Font Awesome Free (https://fontawesome.com/)
const FONT_AWESOME_ICONS = {
  'fa-print': {
    vb: '0 0 512 512',
    d: 'M128 0C92.7 0 64 28.7 64 64l0 96 64 0 0-96 256 0 0 96 64 0 0-96c0-35.3-28.7-64-64-64L128 0zM19.2 256C8.6 256 0 264.6 0 275.2L0 448c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-172.8c0-10.6-8.6-19.2-19.2-19.2L19.2 256zM384 320l64 0 0 64-64 0 0-64zM96 352l320 0 0 128-320 0 0-128z',
  },
  'fa-copy': {
    vb: '0 0 448 512',
    d: 'M384 336l-192 0c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l140.1 0L384 96.1 384 320c0 8.8-7.2 16-16 16zM192 0C156.7 0 128 28.7 128 64l0 256c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-223.9c0-17-6.7-33.3-18.7-45.3L371.3 18.7C359.3 6.7 343 0 326.1 0L192 0zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-16-64 0 0 16c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l16 0 0-64-16 0z',
  },
  'fa-truck-fast': {
    vb: '0 0 640 512',
    d: 'M624 352h-16V243.9c0-12.7-5.1-24.9-14.1-33.9L494 110.1c-9-9-21.2-14.1-33.9-14.1H416V48c0-26.5-21.5-48-48-48H112C85.5 0 64 21.5 64 48v48H16c-8.8 0-16 7.2-16 16s7.2 16 16 16h48v64H32c-8.8 0-16 7.2-16 16s7.2 16 16 16h32v64H48c-8.8 0-16 7.2-16 16s7.2 16 16 16h45.3c-8.5 13.9-13.3 30.3-13.3 48 0 53 43 96 96 96s96-43 96-96c0-17.7-4.8-34.1-13.3-48h146.7c-8.5 13.9-13.3 30.3-13.3 48 0 53 43 96 96 96s96-43 96-96c0-17.7-4.8-34.1-13.3-48H624c8.8 0 16-7.2 16-16s-7.2-16-16-16zM176 464c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm336 0c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm-96-256V144h44.1l99.9 99.9V208h-144z',
  },
  'fa-box-open': {
    vb: '0 0 640 512',
    d: 'M58.9 42.2c3-6.1 9.3-10.2 16.1-10.2H216c6.8 0 12.9 3.7 16.1 9.8L320 216 230.1 276.1c-18.7 12.5-43.8 7.1-55.8-12.2L58.9 42.2zM581.1 42.2l-115.4 221.7c-12 19.3-37.1 24.7-55.8 12.2L320 216l87.9-174.2c3.2-6.1 9.3-9.8 16.1-9.8H565c6.8 0 13.1 4.1 16.1 10.2zM0 312c0-22.1 17.9-40 40-40h101.4l58.4 38.9c36.4 24.3 84.7 18.9 115-13.1l5.2-5.8 5.2 5.8c30.3 32 78.6 37.4 115 13.1L498.6 272H600c22.1 0 40 17.9 40 40v152c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V312z',
  },
  'fa-headset': {
    vb: '0 0 512 512',
    d: 'M256 32C114.6 32 0 146.6 0 288v40c0 13.3 10.7 24 24 24h48c13.3 0 24-10.7 24-24V288c0-88.4 71.6-160 160-160s160 71.6 160 160v40c0 13.3 10.7 24 24 24h48c13.3 0 24-10.7 24-24V288C512 146.6 397.4 32 256 32zM96 288H32v-32c0-123.7 100.3-224 224-224s224 100.3 224 224v32h-64v-32c0-88.4-71.6-160-160-160S96 167.6 96 256v32zm320 64h64v96c0 35.3-28.7 64-64 64H272c-8.8 0-16-7.2-16-16s7.2-16 16-16h144c17.7 0 32-14.3 32-32V352z',
  },
  'fa-check-double': {
    vb: '0 0 512 512',
    d: 'M173.898 438.5l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.496c-9.998 9.997-26.207 9.997-36.204 0z',
  },
  'fa-circle-check': {
    vb: '0 0 512 512',
    d: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z',
  },
}

// Mapa de arquetipos de movimiento semántico por icono (19 dinámicas físicas diferenciadas)
const MOTION_POR_ICONO = {
  // 1. Péndulo de campana
  bell: 'ring',
  // 2. Desplazamiento vehicular con suspensión
  truck: 'drive',
  'fa-truck-fast': 'drive',
  // 3. Despegue diagonal (envío)
  send: 'launch',
  // 4. Trazo creativo / inclinación de pluma
  pen: 'write',
  edit: 'write',
  // 5. Pulso mecánico de cabezal de impresión
  printer: 'print',
  'fa-print': 'print',
  // 6. Corte de cizalla / tijera
  scissors: 'snip',
  // 7. Giro continuo de actualización o astro
  refresh: 'spin',
  sun: 'spin',
  // 8. Pulso horario de escape
  clock: 'tick',
  calendar: 'tick',
  // 9. Rebote elástico de verificación
  check: 'check-pop',
  'check-circle': 'check-pop',
  'fa-check-double': 'check-pop',
  'fa-circle-check': 'check-pop',
  shield: 'check-pop',
  // 10. Vibración horizontal de advertencia
  'alert-triangle': 'alert-shake',
  'alert-circle': 'alert-shake',
  'x-circle': 'alert-shake',
  x: 'alert-shake',
  flag: 'alert-shake',
  // 11. Cuarto de vuelta de precisión
  plus: 'quarter-turn',
  'file-plus': 'quarter-turn',
  wrench: 'quarter-turn',
  // 12. Impulso direccional derecho
  'arrow-right': 'nudge-right',
  'chevron-right': 'nudge-right',
  'log-out': 'nudge-right',
  play: 'nudge-right',
  // 13. Impulso direccional izquierdo
  'arrow-left': 'nudge-left',
  'chevron-left': 'nudge-left',
  // 14. Descenso en bandeja
  'chevron-down': 'nudge-down',
  download: 'nudge-down',
  inbox: 'nudge-down',
  // 15. Ascenso y despegue vertical
  'chevron-up': 'nudge-up',
  upload: 'nudge-up',
  'trending-up': 'nudge-up',
  // 16. Expansión de barras y telemetría
  'bar-chart': 'pulse-bars',
  activity: 'pulse-bars',
  layers: 'pulse-bars',
  grid: 'pulse-bars',
  columns: 'pulse-bars',
  layout: 'pulse-bars',
  list: 'pulse-bars',
  list2: 'pulse-bars',
  filter: 'pulse-bars',
  // 17. Lente de inspección óptica
  search: 'inspect',
  eye: 'inspect',
  'eye-off': 'inspect',
  image: 'inspect',
  'map-pin': 'inspect',
  // 18. Balanceo de soporte y comunicación
  'life-buoy': 'rock-wave',
  'fa-headset': 'rock-wave',
  message: 'rock-wave',
  'message-circle': 'rock-wave',
  mail: 'rock-wave',
  phone: 'rock-wave',
  lock: 'rock-wave',
  info: 'rock-wave',
  // 19. Elevación táctil con resorte
  home: 'float-bounce',
  users: 'float-bounce',
  user: 'float-bounce',
  package: 'float-bounce',
  'fa-box-open': 'float-bounce',
  clipboard: 'float-bounce',
  'file-text': 'float-bounce',
  folder: 'float-bounce',
  copy: 'float-bounce',
  'fa-copy': 'float-bounce',
  star: 'float-bounce',
  moon: 'float-bounce',
  pause: 'float-bounce',
  menu: 'float-bounce',
  paperclip: 'float-bounce',
}

export default function Icon({ nombre, tamano = 18, className = '' }) {
  const motion = MOTION_POR_ICONO[nombre] || 'float-bounce'
  const esNotdogPilot = Boolean(NOTDOG_SOLID_PILOT[nombre])
  const clasesBase = `icon ${esNotdogPilot ? 'icon-notdog' : 'icon-stroke'} icon-motion-${motion} ${className}`.trim()

  if (FONT_AWESOME_ICONS[nombre]) {
    const fa = FONT_AWESOME_ICONS[nombre]
    return (
      <svg
        className={`icon-fa ${clasesBase}`.trim()}
        data-motion={motion}
        width={tamano}
        height={tamano}
        viewBox={fa.vb}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={fa.d} />
      </svg>
    )
  }

  if (esNotdogPilot) {
    return (
      <svg
        className={clasesBase}
        data-motion={motion}
        data-style="notdog-solid"
        width={tamano}
        height={tamano}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {NOTDOG_SOLID_PILOT[nombre]}
      </svg>
    )
  }

  return (
    <svg
      className={clasesBase}
      data-motion={motion}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONOS[nombre] || NOTDOG_SOLID_PILOT.info}
    </svg>
  )
}
