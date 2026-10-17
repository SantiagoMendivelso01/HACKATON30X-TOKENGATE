# Sesión grill-me 5 — MVP y estrategia de demo

**Fecha:** viernes 16-oct-2026, 21:48 · **Participantes:** equipo · **Estado:** cerrada

## Hechos nuevos que cambiaron el plan
- La hackathon **ya está en curso**. **Entrega y demo: domingo 18-oct a las 10:00.**
- Por la Ley 2300, **solo se puede contactar el sábado de 8:00 a 15:00**. El viernes por la noche y el domingo no hay contacto.
- **Los organizadores no entregan nada:** ni perfil de cliente ideal, ni las 50 empresas, ni entorno de Dapta. Se pide hacerlo lo más sencillo posible.
- El equipo es de **2 a 3 personas**.

## Decisiones tomadas

| # | Decisión | Cambia a |
|---|---|---|
| D45 | **Recorte aceptado.**<br>**Se mantiene:** 2 fuentes, deduplicación, filtro por perfil, 3 brazos, "Llámenme ahora" con diagnóstico mínimo, webhook de Dapta, libro de costos, matriz con CPL/CPQL e intervalos, filtro de cumplimiento, verificador de afirmaciones, CPL incremental.<br>**Se degrada:** ver D46–D51.<br>**Se corta:** conciliación por MCP (queda el webhook con el payload crudo), botón de referidos, laboratorio editable (pesos y umbrales fijos en la configuración) | D13, D35 |
| D46 | **2 oleadas:** la primera el sábado a las 8:00 con reparto uniforme; la segunda hacia las 11:00 con Thompson y **maduración de 3 h** | D11 |
| D47 | **Frase de recomendación:** primero la plantilla determinista. El LLM con verificador solo si sobra tiempo | D20 |
| D48 | **Interfaz:** los catálogos de traducción existen, pero **solo se rellena el español**. Inglés si sobra tiempo | D32 |
| D49 | **Tema:** tokens con colores de Dapta; nada más. Se mantiene el rótulo "construido para Dapta (proyecto de hackathon)" | D31 |
| D50 | **Un solo cliente configurado.** La tabla `client` se conserva y no hay selector en la interfaz | D23 |
| D51 | **2 señales del radar:** web con WhatsApp o chat, y matrícula reciente en el RUES. **Tiempo humano** medido como tiempo entre abrir y aprobar la revisión | D5, D16 |
| D52 | **Campaña real:** el cliente es **Faro mismo** ("Faro, proyecto de la hackathon de Dapta"), con una **oferta honesta**: diagnóstico gratuito de cómo atienden sus leads y prueba con un agente de voz. **Perfil:** clínicas odontológicas y estéticas de Bogotá (abren los sábados y reciben muchas llamadas). El calificador pregunta por volumen de leads, cómo los atienden hoy e interés | D8 (la demo deja de usar el perfil de los organizadores) |
| D53 | **Demo del domingo:** el jurado solicita la llamada en vivo con consentimiento expreso. El filtro de cumplimiento admite la excepción **"llamada solicitada por el titular en el momento"** fuera de horario, auditada. La interpretación legal está [NC] y se dice en el pitch. **Plan B:** grabación y payload de una llamada real del sábado, presentada como grabación | ADR-003 |

## Volumen objetivo
- **Unos 90 leads por oleada** (6 brazos × 15) → **unos 180 contactos en total**.
- Brevo permite 300 al día. Dapta Pro permite 5 llamadas simultáneas, y las secuencias marcan 1 llamada cada 3 s.
- La matriz va a tener intervalos anchos, y eso es lo esperado (R1).

## Roles

| Persona | Responsabilidad |
|---|---|
| **A: cuentas y Dapta** | Cuentas, llaves, dominio, Brevo, agente y flows de Dapta, prueba técnica de Dapta |
| **B: código** | Coordina a los agentes de código, revisa los PR y prueba de punta a punta |
| **C: producto y pitch** | Textos legales (consentimiento, privacidad, baja), apertura del agente calificador, guion de la demo, video de respaldo, pitch. Si son 2 personas, C se reparte entre A y B |

## Cronograma

| Cuándo | Qué | Hito verificable |
|---|---|---|
| Vie 22:00–00:00 | A: cuentas. B: repo, esquema y despliegue vacío. C: textos legales y prompt del agente | URL pública en línea; `.env` completo (nunca en el chat ni en el repo) |
| 00:00–01:30 | **Prueba técnica de Dapta:** flows A y B → llamada a un celular colombiano del equipo → webhook capturado. **Probar si un número de EE. UU. de Dapta llama a Colombia y cuánto cuesta** | Payload real en `fixtures/dapta/`. Decisión sobre el número |
| 01:30–05:00 | Módulos en paralelo con agentes (ver los issues) | Tests en verde por módulo |
| 05:00–07:00 | Prueba de punta a punta con teléfonos y correos del equipo. Descubrimiento real de la campaña | Un lead de prueba llega a "calificado". Al menos 180 leads del perfil listos |
| 07:00–08:00 | Revisión y aprobación de la oleada 1 | Oleada aprobada |
| **Sáb 08:00** | **Oleada 1** | Contactos confirmados por el proveedor |
| **Sáb ~11:00** | **Oleada 2** (Thompson, maduración de 3 h) | Asignación reportada |
| Sáb 15:00 | Fin de la ventana de contacto | — |
| Sáb 15:00–22:00 | Tablero, pulido, README e issues cerrados. **Grabar el video de respaldo** con una llamada real | Video grabado |
| Dom 06:00–09:00 | Congelar el código, 3 ensayos | Demo de menos de 3 min |
| **Dom 10:00** | **Demo** | — |

Los turnos de descanso se reparten para que siempre haya alguien atento a los webhooks durante la ventana del sábado.

## Guion de la demo (≤ 3 min)
1. **Problema (20 s).** "3 de cada 5 leads de Dapta preguntan si también les conseguimos clientes."
2. **Puente de mando con datos reales del sábado (60 s).** La frase de recomendación, la matriz 2×3, los costos con su recibo y una alerta de cumplimiento.
3. **Momento en vivo (60 s).** Un jurado abre un diagnóstico en su celular y pide "Llámenme ahora". El agente de Dapta lo llama, lo califica y el tablero se actualiza.
4. **Lo que aprendimos (30 s).** Cuántos leads encontramos, cuántos contactamos, cuántos se calificaron y el costo por lead calificado de cada brazo, con su evidencia. Todo con números reales.
5. **Cierre (10 s).** El lema.

## Riesgos principales
- **R14 (crítico):** no conseguir un número que llame a Colombia antes del sábado a las 8:00.
  - Plan B1: número de EE. UU. de Dapta, si llama a Colombia.
  - Plan B2: la voz solo funciona con "Llámenme ahora" (con opt-in) y el brazo de llamada directa se declara no ejecutado.
  - Nunca simulamos la voz.
- **R15:** Brevo no valida la cuenta a tiempo. El plan B es la Gmail API (D39).
- **R16:** la facturación de Google Places exige tarjeta. Si no está lista, la fila de Places se descubre más tarde o queda solo SECOP. **Esto rompe el requisito de 2 fuentes**, así que tiene prioridad para la persona A.

## Siguientes pasos
- **Ya, en paralelo:** la persona A abre las cuentas (lista en el plan del producto §6).
- **Sesión 6 (exprés): issues.** Convertir la arquitectura en issues de GitHub y arrancar a los agentes.
