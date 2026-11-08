# Sistema de Iconografía Vectorial Animada - ORVEX (Huellas Publicidad)

Este directorio documenta el sistema de iconografía vectorial de doble capa (`Icon.jsx` y `ModuleIcon.jsx`) utilizado en el Dashboard, la navegación lateral, las tarjetas de indicadores (KPIs) y los encabezados de módulo de ORVEX.

## 1. Arquitectura Vectorial de Doble Capa

ORVEX utiliza iconos vectoriales SVG limpios y escalables (sin imágenes rasterizadas 3D pesadas), estructurados en tres capas semánticas para permitir profundidad visual y micro-interacciones coherentes:

- `.icon-part-primary`: Contorno estructural principal (`strokeWidth: 1.9`).
- `.icon-part-secondary`: Elementos secundarios con opacidad diferencial (`0.78` en reposo, `1.0` en `hover`/`focus-visible`).
- `.icon-part-detail`: Pieza articulada (manecillas de reloj, ruedas de transporte, hoja de impresión, marca de verificación) que responde con micro-animaciones individuales.

## 2. Arquetipos de Micro-Animación Semántica (`data-motion`)

Cada icono responde al pasar el cursor sobre su contenedor interactivo (`.btn`, `.kpi`, `.nav-item`, `.quick`, `.card-head`, `.page-head`, `.chip`, `.tab`) según su significado operativo:

1. `ring` (`campana`, `telefono`): Oscilación de aviso suave.
2. `drive` (`camion`, `entregas`): Desplazamiento horizontal con giro de ruedas.
3. `launch` (`enviar`): Impulso diagonal ascendente.
4. `write` (`editar`, `diseno`): Inclinación de trazo editorial.
5. `print` (`impresora`): Avance vertical de hoja impresa.
6. `snip` (`corte`): Articulación de hojas de corte y acabado.
7. `spin` (`sincronizar`): Rotación de actualización de 90°.
8. `tick` (`reloj`, `tiempos`): Avance de aguja horaria.
9. `check-pop` (`check`, `escudo`, `aprobacion`): Pulso elástico de validación.
10. `alert-shake` (`alerta`, `bloqueo`): Vibración horizontal preventiva.
11. `quarter-turn` (`mas`, `cerrar`): Giro de cuarto de vuelta.
12. `nudge-right` / `nudge-left` / `nudge-down` / `nudge-up`: Desplazamiento direccional de navegación y transferencia de archivos.
13. `pulse-bars` (`reportes`, `tendencia`): Elevación de barras analíticas.
14. `inspect` (`buscar`, `ver`, `filtrar`): Enfoque óptico de inspección.
15. `rock-wave` (`mensajes`, `correo`, `postventa`): Balanceo conversacional.
16. `float-bounce` (`tablero`, `ordenes`, `clientes`, `inventario`, `solicitudes`): Elevación suave con desfase de capa interna.

## 3. Accesibilidad (`prefers-reduced-motion`)

Todas las transformaciones utilizan propiedades CSS individuales (`translate`, `rotate`, `scale`) aceleradas por GPU y respetan `@media (prefers-reduced-motion: reduce)` desactivando desplazamientos espaciales mientras conservan el contraste y la respuesta cromática.
