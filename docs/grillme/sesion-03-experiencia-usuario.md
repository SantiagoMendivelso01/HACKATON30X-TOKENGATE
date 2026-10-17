# Sesión grill-me 3: experiencia de usuario

**Fecha:** 16-oct-2026 · **Participantes:** equipo · **Estado:** cerrada

## Decisiones tomadas

| # | Pregunta | Decisión | Descartado y por qué |
|---|---|---|---|
| D22 | Usuario que opera Faro | **Operador de Dapta** (customer success / growth) que consigue leads para pymes cliente. La interfaz es densa y el laboratorio está a la vista. La pyme ve el diagnóstico público y, en el roadmap, un reporte | *Decisión del equipo frente a la recomendación "dueño de pyme con lo avanzado escondido".* Encaja con el giro de Dapta hacia generación de demanda y cobro por resultados. "Analista de growth" abruma |
| D23 | Varios clientes en el MVP | **El modelo de datos se organiza por cliente** (marca, oferta, perfil, CPL de pauta) y sus campañas, con selector de cliente. **Un solo login**, sin roles. La demo usa **un cliente real**; no se inventa un segundo | Un solo cliente cuesta migrar después. La vista de cartera necesita datos de varios clientes: roadmap |
| D24 | Pantalla principal de la campaña | **Puente de mando.** Frase de recomendación arriba. Matriz 2×3 al centro: cada celda muestra embudo, costo por calificado, P(mejor) y estado (activa, apagada, sin evidencia). Registro en vivo a la derecha. Acción pendiente abajo. Tabla de leads a un clic | La tabla como inicio relega al protagonista. El kanban es ilegible con cientos de leads |
| D25 | Crear campaña | **Descripción libre → configuración editable.** El LLM propone CIIU, consultas de Places y filtros, y el operador edita. **Vista previa** de conteos por fuente con costo estimado antes de lanzar | El formulario exige saber CIIU. Las plantillas por vertical son rígidas frente a un perfil desconocido |
| D26 | Aprobación de oleada | **Revisión por brazo:**<br>• resumen con cantidad, costo estimado y horario de las llamadas;<br>• 3 mensajes de muestra por brazo, con cada afirmación subrayada y enlazada a su fuente;<br>• bloqueados con su motivo (editar o descartar);<br>• confirmación final con total, costo y avisos de cumplimiento.<br>Se mide el tiempo humano | La bandeja uno a uno contradice D10. El temporizador contacta sin un sí explícito |
| D27 | Transparencia en vivo | **Registro con 4 estados:** trabajando, esperando un sistema externo, requiere tu atención, completado. *Completado* solo con confirmación externa. Cada evento enlaza al lead y a su costo | Mostrar el razonamiento del LLM es ruido sin verificar. Las barras no explican atascos |
| D28 | Detalle del lead (dossier) | **3 líneas** (quiénes son, por qué encajan, cómo abrir la conversación). Debajo:<br>• hechos con fuente y licencia por campo (lo de Places marcado "en vivo, no guardado");<br>• señales del radar;<br>• historial (mensajes, llamada Dapta con resumen, variables y grabación, rechazos);<br>• recibo de costos | El informe narrativo no cabe en 30 s. Las pestañas crudas no se entienden |
| D29 | Acción del diagnóstico público | **"Llámenme ahora"** con teléfono y casilla de autorización explícita: el agente de Dapta llama en < 1 min. Secundarias: WhatsApp (`wa.me`), compartir con un colega (D13) y no volver a contactarme. Firmado por la marca del cliente | La llamada en el navegador no está confirmada como integrable. Agendar elimina el momento en vivo |
| D30 | Fallos | **Pausa segura por brazo:**<br>• los pasos sin contacto se reintentan solos;<br>• **los contactos nunca se reintentan sin certeza de que no salieron** (quedan "sin confirmar" y piden atención);<br>• pausa automática del brazo con > 20% de errores, webhook de Dapta ausente > 15 min o pico de rechazo;<br>• botón global de pausa siempre visible | "Reintentar todo" arriesga doble contacto (Ley 2300). "Solo registrar" deja gastando a un brazo roto |
| D31 | Dirección visual | **Módulo de Dapta.** Se toman la paleta, la tipografía y el tono de su producto público, sin copiar pantallas. Siempre se rotula "Faro, construido para Dapta (proyecto de hackathon)" y no se usa su logo como producto oficial. **Requiere el permiso de los organizadores.** Plan B: "instrumento de medición" (misma estructura). Números tabulares y color solo para estados | *Decisión del equipo frente a la recomendación "instrumento de medición".* La sala de control oscura se lee mal proyectada |
| D32 | Idioma | **Interfaz bilingüe ES/EN** con catálogos de traducción desde el día 1. El idioma de la interfaz (del operador) es independiente del **idioma de contacto** (de la campaña; español de Colombia para la demo) | *Decisión del equipo frente a "solo español".* Costo: doble texto y plantillas de LLM por idioma |
| D33 | Dispositivos | **Operador en escritorio** (en el celular, solo lectura: frase, matriz, actividad, pausa). **Diagnóstico pensado primero para celular.** Accesibilidad WCAG AA. *Tomada por defecto, reversible* | Todo en celular no admite bien la matriz ni la revisión de lotes |

## Supuestos pendientes de validar
- **S-J:** los organizadores permiten usar la identidad visual de Dapta (D31).
- **S-K:** el agente de Dapta puede llamar en < 1 min tras el opt-in. Depende de la latencia del flow y la secuencia; se valida con la prueba técnica de Dapta.
- **S-L:** el texto de autorización del diagnóstico cumple la Ley 1581 y la Ley 2300 (finalidad, responsable, canal y revocación). Pendiente de redacción y revisión.
- **S-M:** el LLM traduce bien la descripción libre a CIIU. Hay que validarlo con 5 perfiles de prueba antes de la demo.

## Riesgos identificados
- **R8:** el alcance de la interfaz creció (cliente, bilingüe, módulo de Dapta) dentro de las mismas 24 h. **Se ajusta en la sesión 5**, donde puede haber recortes.
- **R9:** para la llamada en vivo al jurado hace falta que el número de Dapta esté activo y que la llamada caiga dentro del horario legal en la hora de la demo.
- **R10:** si se niega el permiso de marca a mitad del evento, hay que cambiar el tema visual. Por eso los colores se definen como tokens desde el primer día.

## Siguientes pasos
- Hecho al cerrar esta sesión: ADR-005 (experiencia de usuario) y la definición de producto marcada como reemplazada en lo que contradiga los ADR.
- **Sesión 4: arquitectura e integración con Dapta.** Componentes, datos, jobs, contratos con Dapta (Public Route y webhook), proveedores de email y LLM, umbrales estadísticos, seguridad y observabilidad. Al cerrarla se consolidan el ADR-003, el ADR-004 y los nuevos ADR técnicos.
