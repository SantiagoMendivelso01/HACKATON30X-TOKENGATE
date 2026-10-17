# ADR-005: Experiencia de usuario

**Estado:** Aceptado en la [sesión grill-me 3](./sesion-03-experiencia-usuario.md) (16-oct-2026)

> **Modificado en la [sesión grill-me 5](./sesion-05-mvp-demo.md):** ver D45–D53 (2 oleadas con maduración de 3 h, frase por plantilla primero, solo español rellenado, un cliente, 2 señales, sin conciliación MCP ni referidos, campaña propia de Faro, excepción de llamada solicitada por el titular). Donde este ADR contradiga a D45–D53, manda la sesión 5.

## Contexto
Faro tiene que ser operable por una persona con criterio comercial. También tiene que ser transparente sobre lo que hace la IA y no presentar como hecho nada que no lo esté. Además, debe brillar en una demo de menos de 3 minutos.

## Decisión

**Usuario.** Es el operador de Dapta, que consigue leads para pymes cliente. Hay un solo login, sin roles. Los datos se organizan por **cliente** (marca, oferta, perfil, CPL de pauta) y cada cliente tiene sus campañas.

**Pantallas del MVP:**

| Pantalla | Contenido |
|---|---|
| Selector de cliente | Lista de clientes y creación de uno nuevo |
| Nueva campaña | Descripción libre → configuración editable (CIIU, consultas, filtros) → vista previa de conteos y costo → lanzar |
| **Puente de mando** (inicio de la campaña) | Frase de recomendación; matriz 2×3 (embudo, costo por calificado, P(mejor), estado); registro en vivo; acción pendiente |
| Leads | Tabla densa con filtros; acceso al detalle |
| Detalle del lead | 3 líneas; hechos con fuente y licencia; señales; historial; recibo de costos |
| Revisión de oleada | Resumen por brazo; 3 muestras por brazo con afirmaciones enlazadas; bloqueados; confirmación final |
| Laboratorio | Pesos, umbrales, vista variable/total, tiempo humano, frase con verificación |
| **Diagnóstico público** `/d/[token]` | Marca del cliente; solo datos verificables; "Llámenme ahora" con autorización; WhatsApp; compartir; baja |
| Políticas | Tratamiento de datos y baja |

**Reglas transversales:**
- **Cuatro estados:** trabajando, esperando un sistema externo, requiere tu atención y completado. *Completado* solo se muestra con confirmación externa. Los estados nunca dependen solo del color.
- **Cada cifra se puede abrir** para ver los asientos que la componen.
- **Ningún contacto se reintenta** sin certeza de que no salió.
- **Pausa automática por brazo** ante anomalías y **pausa global** siempre visible.
- **Idioma:** interfaz ES/EN con catálogos de traducción (ningún texto escrito directamente en los componentes). El idioma de contacto lo define la campaña.
- **Dispositivos:** escritorio para el operador (en el celular, solo lectura). Diagnóstico pensado primero para celular. WCAG AA.

**Identidad visual:**
- Tema "módulo de Dapta" (paleta, tipografía y tono de su producto público), con el rótulo "Faro, construido para Dapta (proyecto de hackathon)". Sin logo de Dapta como producto oficial.
- Todo color y tipografía va en **tokens**, para poder cambiar al tema "instrumento de medición" si los organizadores no autorizan la marca.
- Números en fuente tabular. El color de estado se reserva para estados.

## Consecuencias
- Biblioteca de traducción e infraestructura de temas desde el día 1.
- El diagnóstico usa un tema por cliente: solo su marca (nombre, color y logo opcional).
- El alcance de la interfaz es grande para 24 h. La sesión 5 decide el orden de construcción y los recortes.
