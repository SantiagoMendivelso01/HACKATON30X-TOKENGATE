# Faro: definición de producto (consolidada)

**Estado:** Consolidada al cerrar la [sesión grill-me 5](./sesion-05-mvp-demo.md) (16-oct-2026, 22:30). Si hay conflicto, mandan los ADR: [001](./ADR-001-alcance-y-angulo.md), [002](./ADR-002-metricas-y-modelo-de-costos.md), [003](./ADR-003-fuentes-canales-y-cumplimiento.md), [004](./ADR-004-stack.md), [005](./ADR-005-experiencia-de-usuario.md), [006](./ADR-006-integracion-dapta.md). Arquitectura: [03-arquitectura](./03-arquitectura.md).

## 1. Propuesta de valor
> **No te decimos cuánto cuesta un lead. Te decimos cuánto cuesta uno que vale la pena.**
>
> Faro busca clientes para tu pyme en fuentes públicas, los contacta respetando la ley, deja que el agente de Dapta los califique y te dice dónde buscar y cómo contactar al menor costo por lead calificado.

- **Usuario:** el operador de Dapta, que consigue leads para pymes cliente.
- **Quién lo ve en la calle:** la pyme contactada, a través del diagnóstico público.

## 2. Cómo funciona
1. **Campaña.** El operador describe el perfil en lenguaje libre. Faro lo traduce a CIIU, consultas y filtros, el operador los edita y ve una vista previa de conteos y costo.
2. **Encontrar.** Busca en SECOP II + RUES (datos abiertos) y en Google Places. Deduplica (NIT → teléfono → dominio → nombre) y filtra por perfil. Puntúa 2 señales: web con WhatsApp o chat, y matrícula reciente.
3. **Dossier.** Tres líneas con hechos citados. Lo de Places se lee en vivo y nunca se guarda.
4. **Oleada.** Cada lead del perfil se sortea a un brazo, que es una combinación de fuente y canal. Hay 2 fuentes y 3 canales:
   - email simple;
   - email con diagnóstico;
   - llamada directa de Dapta.

   Un verificador bloquea los mensajes con afirmaciones sin respaldo. El operador aprueba la oleada.
5. **Contactar.** Un filtro de cumplimiento revisa horario, intervalo de 7 días, lista de exclusión, que sea persona jurídica y el presupuesto. Luego Faro envía por Brevo o por Dapta.
6. **Calificar.** El agente de Dapta llama, ya sea por "Llámenme ahora" o por llamada directa, y devuelve la calificación por webhook.
7. **Decidir.** El puente de mando reporta CPL bruto e incremental por fuente, y por cada brazo el costo por conversación real, por lead calificado y por lead sin rechazo, con intervalos. La segunda oleada se reasigna por Thompson. La frase de recomendación sale de una plantilla.

## 3. Pantallas del MVP
- Nueva campaña.
- **Puente de mando** (frase, matriz 2×3, registro con 4 estados, acción pendiente).
- Leads.
- Detalle del lead (3 líneas, evidencia, historial, recibo).
- Revisión de oleada.
- Diagnóstico público `/d/[token]` (pensado primero para celular).
- Páginas legales: privacidad y baja.

Interfaz en español, con catálogos listos para el inglés. Tema con tokens y colores de Dapta.

## 4. Campaña real del evento
- **Cliente:** Faro mismo ("Faro, proyecto de la hackathon de Dapta").
- **Oferta:** diagnóstico gratuito de cómo atienden sus leads y prueba con un agente de voz.
- **Perfil:** clínicas odontológicas y estéticas de Bogotá.
- **Volumen:** unos 90 leads por oleada.
- **Horario:** oleada 1 el sábado a las 8:00 y oleada 2 hacia las 11:00. Los contactos terminan a las 15:00.

## 5. Fuera del MVP (roadmap del pitch)
- Conciliación por MCP.
- Referidos y embajadores.
- Laboratorio editable.
- Frase redactada por LLM (si no sobra tiempo).
- Interfaz en inglés.
- Selector de clientes y vista de cartera.
- WhatsApp Cloud API.
- Fuentes sectoriales (REPS, entre otras).
- Integración con el Registro de Números Excluidos.
- Servidor MCP propio para Dapti.

## 6. Configuración inicial (persona A, ya)
Ningún secreto va en el chat ni en el repo. Todo va a `.env.local` y a las variables de entorno de Vercel y Trigger.dev.

1. **Dapta:**
   - Crear la cuenta y activar la prueba de Pro (requiere tarjeta).
   - Comprar un número de EE. UU. y **probar una llamada a un celular colombiano del equipo**; anotar el costo.
   - Pedir a Soporte un número colombiano (por si llega).
   - Crear el agente calificador, los flows A, B y el de reenvío.
   - Generar la API key del MCP.
2. **Google Cloud:** proyecto, facturación (tarjeta), Places API (New) y una llave restringida.
3. **Email:**
   - Comprar el dominio y crear la cuenta de Brevo.
   - Verificar el dominio (SPF, DKIM, DMARC) y **leer la política de uso de Brevo**.
   - Configurar la recepción de respuestas en el subdominio `r.`
4. **Servicios de la app:** Supabase (2 proyectos), Vercel, Trigger.dev, API key de Anthropic, token de datos.gov.co (Socrata) y repositorio público en GitHub.
