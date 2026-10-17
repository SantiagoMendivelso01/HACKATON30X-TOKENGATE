# ADR-003 — Fuentes, canales y cumplimiento

**Estado:** Aceptado en las sesiones grill-me [1](./sesion-01-problema-alcance-ideas.md) y [4](./sesion-04-arquitectura-dapta.md) (16-oct-2026). Falta validar con los organizadores si se puede contactar a leads reales.

> **Modificado en la [sesión grill-me 5](./sesion-05-mvp-demo.md):** ver D45–D53 (2 oleadas con maduración de 3 h, frase por plantilla primero, solo español rellenado, un cliente, 2 señales, sin conciliación MCP ni referidos, campaña propia de Faro, excepción de llamada solicitada por el titular). Donde este ADR contradiga a D45–D53, manda la sesión 5.

## Contexto
El reto exige respetar los términos de cada fuente y la ley de protección de datos. El detalle está en el [informe de research](../research/01-informe-research.md) §3.

## Decisión

**Línea roja:** solo fuentes y canales legales que respeten los términos de servicio.

Excluidos:
- LinkedIn, X, Telegram, YouTube, Reddit y grupos de Facebook.
- Scraping de Google Maps y de Páginas Amarillas.
- WhatsApp sin opt-in.

### Fuentes

| Fuente | Uso | Qué se guarda |
|---|---|---|
| SECOP II Proveedores `qmzu-gj57` | Descubrimiento con contacto | Solo personas jurídicas. **Nunca** los campos `*_representante_legal`. Licencia CC BY-SA 4.0 por campo |
| RUES `c82u-588k` | CIIU, estado, renovación, llave NIT. Señales del radar (matrículas recientes) | Campos de la empresa |
| Google Places (New) Text Search | Descubrimiento | **Solo `place_id`**. El esquema no tiene columnas para otros datos de Places. Teléfono, web, horario y rating se leen al vuelo y no se persisten |
| Web corporativa | Dossier, señales, email genérico | Respetando robots.txt. Timeout corto. Sin salir del dominio |

### Canales

| Canal | Reglas |
|---|---|
| **Email** (Brevo) | Dominio propio con SPF, DKIM y DMARC. Texto simple. Remitente identificado y fuente del dato citada. Baja en un clic. Sin píxel ni rastreo de enlaces. Respuestas por un subdominio de respuesta |
| **Llamada directa** (Dapta, flow B) | Solo a teléfonos corporativos. El agente se identifica y ofrece la baja al inicio |
| **"Llámenme ahora"** (Dapta, flow A) | Requiere la autorización explícita de la casilla. Enlace ligado a un lead, máximo 2 llamadas al día. Límites por IP y por número. El agente confirma al inicio que la llamada fue solicitada. Queda auditado (hora, IP, texto aceptado) |
| **WhatsApp** | Solo `wa.me`, iniciado por el lead |

### Filtro de cumplimiento
Es una función pura con tests y se ejecuta antes de **cada** contacto. Bloquea si se cumple cualquiera de estas condiciones:
1. Está fuera de horario (L–V 7–19, sábado 8–15, hora de Colombia; nunca domingos ni festivos).
2. Hubo otro contacto por cualquier canal en los últimos 7 días.
3. El lead está en la lista de exclusión (baja propia o Registro de Números Excluidos cargado manualmente).
4. El dato es de una persona natural.
5. Se superó el tope de presupuesto.

El motivo del bloqueo se muestra en la UI.

## Consecuencias
- **Limitación declarada:** no consultamos el Registro de Números Excluidos de forma automática.
- Faro publica dos páginas: la política de tratamiento de datos y la de baja.
- Antes del evento hay que verificar que la política de uso de Brevo admite nuestro caso.
