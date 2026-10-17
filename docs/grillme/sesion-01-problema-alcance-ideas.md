# Sesión grill-me 1: problema, alcance e integración de las 8 ideas

**Fecha:** 16-oct-2026 · **Participantes:** equipo · **Estado:** cerrada

## Decisiones tomadas

| # | Pregunta | Decisión | Alternativa descartada y por qué |
|---|---|---|---|
| D1 | Línea roja de fuentes y canales | **Solo fuentes y canales legales que respeten los términos de servicio.** Las 8 ideas entran reformuladas | "Tal como están": LinkedIn, X, Telegram y YouTube violan términos de servicio y la Ley 2300, y eso descalifica, porque cumplir es un requisito obligatorio del reto |
| D2 | Idea protagonista | **"El que decide"** (ideas 8 + 2 + 4): la recomendación en una frase, el experimento de canales y las métricas de calidad | "El que conoce" (1+3) y "el que anticipa" (5+7) no responden "dónde conviene buscar" |
| D3 | Canales de primer contacto (brazos) | **3:** email simple, email con diagnóstico personalizado, llamada directa del agente de Dapta | El formulario web choca con captchas y términos, y diluye la muestra |
| D4 | Diseño del experimento | **Matriz completa** fuente × canal. Los totales por fuente y por canal se muestran como resumen | El equipo eligió esto sobre "dos ejes con sorteo por fuente". **Riesgo aceptado:** intervalos anchos con muestras pequeñas |
| D5 | Filas (fuentes) | **2:** datos abiertos (SECOP + RUES) y Google Places → **6 brazos.** El radar de señales (ideas 5 y 7) es una **puntuación**, no una fila. Se mide si los leads con señal califican más | Con 3 filas serían 9 brazos de unos 15–20 contactos cada uno |
| D6 | "Conversación real" (idea 4) | **Intercambio humano verificable:** email respondido por una persona (sin autorespuestas ni rebotes) o llamada de Dapta contestada por un humano, sin buzón, de 30 s o más y con respuestas del lead. El umbral final se ajusta con el payload real de Dapta | "Cualquier respuesta" mide actividad, no conversación |
| D7 | "Lead que no odia la marca" (idea 4) | **Señales explícitas de rechazo:** opt-out, queja de spam, respuesta hostil (LLM con evidencia citada), cuelgue antes de 10 s tras identificarnos, sentimiento negativo en la llamada. Métricas: costo por lead sin rechazo y tasa de rechazo por brazo | Un puntaje continuo de sentimiento es una caja negra difícil de defender |
| D8 | Para quién trabaja Faro | **Para cualquier pyme cliente de Dapta.** Cada campaña define marca, oferta y perfil. La demo usa el perfil de los organizadores con un remitente siempre identificado | "Para Dapta mismo" responde menos al problema del reto |
| D9 | Dossier de 30 s (idea 1) | **El dossier guardado usa solo fuentes almacenables** (web corporativa, RUES, SECOP). **Lo de Places se añade en vivo y nunca se persiste.** Un dossier, tres usos: contexto del agente de Dapta, mensaje y vista humana | "Todo guardado" viola los términos de Google Maps |
| D10 | Control del mensaje personalizado (idea 3) | **Verificador automático:** toda afirmación debe apuntar a un hecho del dossier con su fuente, o se bloquea. **Un humano aprueba por lote** viendo una muestra y los bloqueados. Nada de fingir cercanía | La aprobación mensaje a mensaje frena el contacto; enviar sin revisión multiplica errores |
| D11 | Apagado de canales (idea 2) | **3 oleadas.** La 1 reparte por igual; la 2 y la 3 reasignan por Thompson usando solo resultados **maduros** (4 h desde el contacto, igual para todos los brazos). Un brazo se apaga si P(mejor) < 5% con un mínimo de contactos. P(mejor) también da la mezcla de la idea 8 | Una regla dura sesgaría contra el email, que responde más lento |
| D12 | Qué optimiza la reasignación | **Valor ponderado del embudo ÷ costo:** conversación real = 1, calificado por Dapta = 3, rechazo = −1. Los pesos son configurables y se ven en el tablero. El costo por lead calificado se reporta aparte | Con 0–3 calificados por brazo, optimizar el costo por lead calificado puro es optimizar ruido |
| D13 | Embajadores (idea 6) | **Mínimo medible:** botón "compártelo con un colega" en el diagnóstico, con enlace rastreable. Los referidos entran como fuente en el tablero, sin brazo propio. El programa completo va al roadmap | Un seguimiento automático viola el límite de un contacto por semana |

## Cómo queda cada idea

| Idea | Rol en Faro |
|---|---|
| 1. Dossier de 30 s | Contexto para el agente de Dapta, el mensaje y la vista humana (D9) |
| 2. Prueba de canales y apagado | Las oleadas con Thompson (D11, D12) |
| 3. Mensaje personalizado | Personalización con hechos verificados (D10) |
| 4. Conversación real y lead que no odia la marca | Métricas del tablero (D6, D7) |
| 5. Radar de "a punto de necesitarte" | Puntuación por señales, en escaneo diario (D5) |
| 6. Embajadores | Referidos rastreables + roadmap (D13) |
| 7. Fuentes que nadie mira | Datos abiertos sectoriales de Colombia como señales (D5) |
| 8. Dashboard en una frase | Frase de recomendación con la mezcla P(mejor) (D11) |

## Supuestos pendientes de validar
- **S-A:** en 24 h se contactan entre 100 y 200 empresas. Esto define si la matriz de 6 brazos produce algo legible. Se decide en la sesión 5.
- **S-B:** el payload de Dapta trae lo necesario para D6 y D7 (duración, buzón, turnos, sentimiento). Se valida con la prueba técnica de Dapta.
- **S-C:** los organizadores aceptan que los mensajes los firme un remitente de la hackathon, o nos dicen cuál usar.
- **S-D:** 4 h es una ventana de maduración razonable para el email. Se revisa con los datos de la oleada 1.
- **S-E:** existen fuentes sectoriales abiertas útiles para el radar (p. ej. el REPS para salud). No verificado.

## Riesgos identificados
- **R1, matriz con muestras pequeñas (aceptado):** el tablero tiene que comunicar "sin evidencia suficiente" sin que parezca que el producto falla.
- **R2, oleadas y Ley 2300:** el límite de un contacto por semana impide recontactar al mismo lead entre oleadas. Cada oleada usa leads nuevos, así que necesitamos al menos 3 lotes de leads del perfil.
- **R3, falsos positivos del verificador:** si bloquea demasiado, los mensajes quedan genéricos y el brazo "email + diagnóstico" pierde su ventaja.
- **R4, la llamada en vivo depende de Dapta:** la cubre el plan B, que se define en la sesión 5.

## Siguientes pasos
- Actualizar el ADR-001 con estas decisiones (hecho al cerrar esta sesión).
- **Sesión 2: propuesta de valor y métricas.** Modelo de costos (variables, fijos, tiempo humano), atribución entre fuentes, cómo se calcula el CPL por fuente, la frase de la idea 8 y propuesta de valor final. Al cerrarla se consolida el ADR-002.
- Siguen abiertas las preguntas a los organizadores del informe de research (§7.1).
