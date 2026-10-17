# ADR-001: Alcance y ángulo del producto

**Estado:** Aceptado en la [sesión grill-me 1](./sesion-01-problema-alcance-ideas.md) (16-oct-2026)

> **Modificado en la [sesión grill-me 5](./sesion-05-mvp-demo.md):** ver D45–D53 (2 oleadas con maduración de 3 h, frase por plantilla primero, solo español rellenado, un cliente, 2 señales, sin conciliación MCP ni referidos, campaña propia de Faro, excepción de llamada solicitada por el titular). Donde este ADR contradiga a D45–D53, manda la sesión 5.

## Contexto
- El reto pide cuatro cosas: encontrar leads en al menos 2 fuentes gratuitas, contactarlos, medir el CPL por canal y calificarlos con Dapta.
- Dapta no genera leads.
- Hay 24 h o menos de construcción.
- El equipo propuso 8 ideas para integrar.

## Decisión
**Faro** es un producto para cualquier pyme cliente de Dapta. Cada campaña define la marca, la oferta y el perfil de cliente ideal.

**Su protagonista es "el que decide".** Un experimento de **6 brazos** (2 fuentes × 3 canales) dice en una frase dónde buscar y cómo contactar, con la mezcla recomendada:
- **Fuentes:** datos abiertos (SECOP II + RUES) y Google Places.
- **Canales:** email simple, email con diagnóstico, llamada directa de Dapta.

**Mecánica del experimento:**
- 3 oleadas.
- Reasignación por Thompson con resultados maduros.
- Objetivo: valor ponderado del embudo ÷ costo.
- Apagado de un brazo con P(mejor) < 5%.

**Calidad:** el agente de Dapta califica. Se miden la conversación real y el rechazo con señales explícitas.

**Soporte:**
- Dossier de 30 s sin persistir datos de Places.
- Mensajes con afirmaciones verificadas y aprobación por lote.
- Radar de señales como puntuación.
- Referidos rastreables en el diagnóstico.

**Línea roja:** solo fuentes y canales legales que respeten los términos de servicio. Fuera: LinkedIn, X, Telegram, YouTube, Reddit, grupos de Facebook y scraping de Maps.

**Fuera de alcance:**
- Cerrar la venta.
- WhatsApp Cloud API.
- Programa completo de embajadores.
- Servidor MCP propio.
- Multiusuario.

## Consecuencias
- Toda funcionalidad nueva debe justificar que mejora la decisión "dónde buscar / cómo contactar" o la demo. Si no, va al roadmap.
- Hacen falta al menos 3 lotes de leads del perfil, porque no se recontacta al mismo lead en la misma semana (Ley 2300).
- No hay sistema multiagente. Es un pipeline determinista con pasos de LLM acotados: dossier, señales, mensaje, verificador y clasificación de respuestas.
