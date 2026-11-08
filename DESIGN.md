---
name: ORVEX · Huellas Publicidad
description: Sistema de diseño empresarial para gestión de producción gráfica, diseño y postventa.
colors:
  bg-app-light: "#f5f7fb"
  bg-surface-light: "#ffffff"
  bg-subtle-light: "#f1f5f9"
  bg-app-dark: "#090c12"
  bg-surface-dark: "#10151f"
  bg-subtle-dark: "#161d2a"
  bg-elevated-dark: "#1b2333"
  text-main-light: "#0f172a"
  text-muted-light: "#475569"
  text-main-dark: "#f8fafc"
  text-muted-dark: "#94a3b8"
  primary-electric: "#2563eb"
  primary-electric-dark: "#3b82f6"
  accent-cyan: "#0891b2"
  accent-cyan-dark: "#22d3ee"
  state-emerald: "#059669"
  state-amber: "#d97706"
  state-crimson: "#dc2626"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.018em"
  body:
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "0.933rem"
    fontWeight: 400
    lineHeight: 1.55
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.82rem"
    fontWeight: 600
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-electric}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "9px 16px"
    height: "38px"
  card-surface:
    backgroundColor: "{colors.bg-surface-dark}"
    textColor: "{colors.text-main-dark}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: ORVEX · Huellas Publicidad

## Overview

**Creative North Star: "Precision Print Telemetry"**

ORVEX combina la sobriedad técnica de un centro de control industrial con la pulcritud editorial de un estudio de diseño gráfico. La interfaz prioriza la densidad informativa intencional, la legibilidad inmediata de órdenes, materiales y plazos, y una respuesta física sutil en cada control interactivo.

**Key Characteristics:**
- Superficies pizarra/obsidiana en modo oscuro y papel técnico frío en modo claro, separadas por elevación luminosa de 1px en lugar de bordes laterales gruesos.
- Iconografía vectorial semántica animada: cada icono responde con una micro-física acorde a su función real en el taller.
- Números tabulares (`tabular-nums`) y códigos monoespaciados para identificadores de orden (`ORD-`, `SOL-`, `CAS-`), presupuestos y dimensiones.

## Colors

La paleta preserva la identidad corporativa de ORVEX (Azul Marino, Azul Eléctrico y Cian Técnico), reservando los tonos de semáforo exclusivamente para comunicar el estado operativo real de las órdenes y alertas.

## Typography

- **Plus Jakarta Sans** para encabezados de página, paneles y métricas clave con `text-wrap: balance`.
- **Inter** para lectura sostenida, tablas, formularios y descripciones con `text-wrap: pretty`.
- **JetBrains Mono** para códigos de trazabilidad, dimensiones de impresión y valores monetarios.

## Layout

- Escala espacial de base 4pt/8pt (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`).
- Estructura consistente de barra lateral colapsable (`268px` / `78px`), barra superior contextual (`64px`) y contenedor principal fluido hasta `1480px`.

## Elevation & Depth

- Sombras multicapa suaves combinadas con bisel superior de `1px` (`inset 0 1px 0 rgba(255, 255, 255, 0.06)`).
- Prohibición de bordes laterales gruesos (`border-left: 3px/4px`) y textos con degradado decorativo.

## Shapes

- Radios deliberados: `8px` en inputs, botones y celdas; `14px` en paneles y tarjetas KPI; `9999px` en insignias de estado (badges) y filtros tipo chip.

## Components

- **PageHeader**: Encabezado compacto con icono vectorial animado, telemetría CMYK integrada, título equilibrado y barra de acciones.
- **StatCard (KPI)**: Tarjeta de métrica con cifra tabular, icono con micro-animación semántica y elevación táctil al pasar el cursor.
- **StatusBadge**: Etiqueta semántica con punto indicador (con pulso suave en estados activos en curso) y contraste verificado WCAG AA.
- **DataTable**: Tabla de alta densidad con cabeceras ordenables, buscador instantáneo, filtros alineados (`38px`) y conmutador de vista tabla/tarjetas.

## Do's and Don'ts

- **Do**: Animar únicamente propiedades compuestas por GPU (`translate`, `rotate`, `scale`, `opacity`) con curvas `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Do**: Mantener alturas idénticas entre inputs, selects y botones adyacentes.
- **Don't**: Usar bordes laterales gruesos (`side-tab`) ni texto con `background-clip: text` (`gradient-text`).
- **Don't**: Bloquear la interacción del usuario con animaciones largas o no interrumpibles.
