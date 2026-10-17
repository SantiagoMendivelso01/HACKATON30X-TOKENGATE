# Informe de research — Hackathon Dapta (Fase A)

**Fecha de corte:** 16-oct-2026 · **Estado:** borrador para la sesión 1 · **Autor:** equipo

**Convención.** **[V]** = verificado en la fuente primaria enlazada. **[NC]** = no confirmado: viene de terceros o es una inferencia nuestra. **[H]** = hipótesis nuestra, pendiente de validar. Las cifras [NC] **no** van al pitch sin verificarlas antes.

---

## 0. Resumen ejecutivo (lo que hay que saber en 1 minuto)

1. **El problema ya viene dado.** El reto pide encontrar, contactar, medir el CPL y calificar con Dapta. La pregunta no es *qué problema resolver*, sino **qué ángulo nos diferencia** dentro de ese alcance. Las "oportunidades" de la sección 4 son ángulos de producto sobre el mismo reto, no ideas sueltas.
2. **Dapta no busca leads. Ese hueco es real y está documentado.** Dapta llama, escribe y califica contactos que el cliente le sube (CSV, CRM, Forms). No los encuentra ([doc de importación](https://docs.dapta.ai/llms.txt) [V]). Hace dos días anunció una ronda de US$6M ([Forbes, 14-oct-2026](https://forbes.co/2026/10/14/emprendedores/esta-plataforma-colombiana-de-ia-levanto-us6-millones-en-financiacion/) [V]). En agosto compró una agencia de pauta, Beezion ([Portafolio](https://www.portafolio.co/emprendimiento/colombiana-compra-beezion-para-acelerar-negocios-de-ia-para-ventas-499875) [V]). La prensa también le atribuye un modelo de **pago por resultados**. La generación de demanda es su frente estratégico ahora mismo.
3. **Dapta no tiene API REST pública para disparar llamadas.** La integración documentada es esta: **webhook "Public Route" de Flow Studio → nodo "Add Contact To Sequence" o "Dapta Phone Call" → webhook post-llamada con `call_analysis.custom_analysis_data`** (las variables de calificación). Además hay un **MCP** con 139 herramientas para leer llamadas, leads calificados y saldo ([MCP tools reference](https://docs.dapta.ai/llms.txt) [V]).
4. **"Fuente gratuita" no significa "lead gratis".** Conseguir datos cuesta casi nada. El costo real está en **contactar** (voz por Dapta ≈ US$0,333/min contestado [V]) y en los **costos fijos** (plan, número colombiano a US$28/mes [V]). Un CPL honesto tiene que incluirlos. Ahí hay una oportunidad de diferenciarnos.
5. **La mejor fuente para Colombia no son los mapas. Es SECOP II Proveedores en datos.gov.co.** Tiene 20.830 sociedades activas en Bogotá con correo y teléfono, licencia CC BY-SA y API gratuita ([dataset `qmzu-gj57`](https://www.datos.gov.co/resource/qmzu-gj57.json) [V, conteo propio]). La combinamos con el RUES abierto (`c82u-588k`) para filtrar por perfil de cliente ideal (CIIU, estado) y deduplicar por NIT.
6. **El canal de contacto es la restricción más dura:**
   - WhatsApp **prohíbe escribir sin opt-in previo** ([Meta](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in) [V]).
   - Resend prohíbe el cold email por escrito ([AUP](https://resend.com/legal/acceptable-use) [V]).
   - La Ley 2300/2023 fija horarios y un máximo de contactos, y desde la Circular SIC 1/2024 hay que consultar el **Registro de Números Excluidos** ([Garrigues](https://www.garrigues.com/es_ES/noticia/colombia-empresas-deberan-consultar-registro-numeros-excluidos-antes-enviar-contenidos) [V]).

   El cumplimiento no es un detalle. Determina la arquitectura del contacto.
7. **Recomendación preliminar:** un **"laboratorio de canales"**. La plataforma trata cada combinación *fuente × canal de contacto* como un experimento y mide el embudo completo, hasta el **costo por lead calificado por Dapta (CPQL)**. Prioriza leads con **señales públicas de dolor** que Dapta resuelve. Y pasa todo contacto por un **filtro de cumplimiento colombiano**. La alternativa es un **"diagnóstico gratuito como gancho"**: un contacto que aporta valor y obtiene opt-in legal (sección 6).

---

## 1. Dapta: capacidades verificadas

Fuente principal: la documentación pública en GitBook, https://docs.dapta.ai, con índice completo en [`/llms.txt`](https://docs.dapta.ai/llms.txt). Basta añadir `.md` a cualquier URL para verlo en markdown. La app (app.dapta.ai) requiere login y **no la revisamos**.

### 1.1 Empresa

| Hecho | Estado |
|---|---|
| Startup colombiana fundada en 2023. CEO: Nicolás Rojas; cofundador: Daniel Ordoñez | [V] [Portafolio](https://www.portafolio.co/tecnologia/ia-de-dapta-automatiza-ventas-en-empresas-de-colombia-632969), [Contxto](https://www.contxto.com/en/artificial-intelligence/dapta-secures-1-2m-to-provide-no-code-ai-and-api-integration-solutions-for-smbs/) |
| Sede en Phoenix (AZ) y oficinas en Bogotá | [V] [careers](https://dapta.notion.site/dapta-careers) |
| Pre-seed de US$1,2M (abr-2024). Ronda de US$6M (14-oct-2026) liderada por Chingona Ventures, con 500 Global, Cometa y otros | [V] Contxto, Forbes |
| La empresa dice tener US$4M de ARR y más de 200.000 usuarios registrados | [V] como afirmación de la empresa en Forbes |
| Clientes citados en prensa: Rappi, Mercado Libre, Siigo, Workana | [V] como prensa |
| Pivote: de plataforma no-code de APIs (2024) a **agentes de voz y texto IA para ventas en pymes** | [V] [dapta.ai](https://dapta.ai) |
| Lanzó **Dapti**, un copiloto en español (may-2026) | [V] Portafolio |
| Pago por resultados (reuniones calificadas) | [NC] Sale en prensa, pero no en la página de precios ni en la documentación |
| Construida sobre Retell AI | [NC] Inferencia: los nombres de campos del webhook coinciden con los de Retell |

### 1.2 Producto

- **Voice Agents** (salientes y entrantes), **Text Agents** (WhatsApp, widget web, SMS en EE. UU.), **Sequences**, **Flow Studio**, **Dapta Forms**, **Dapti** y **MCP** [V].
- Agentes prearmados: *Lead Qualifier*, Receptionist, Sales Follow Up, Collections, entre otros [V].
- **Análisis post-llamada** [V]:
  - Define un "Call Objective".
  - Extrae variables tipadas (Text, Selector, Boolean, Number).
  - Envía el resultado a Sheets, HubSpot o flows de Dapta, con hasta 25 destinos por agente.
- **Voz y modelos** [V]:
  - Voz de ElevenLabs (Flash v2.5, Multilingual v2).
  - LLM: "Dapta Auto", GPT 5.6 Luna o Gemini 3.8 Flash.
  - Soporta español.
- **Otras funciones** [V]:
  - Agenda en la llamada (Dapta Calendars / Cal.com).
  - *Warm transfer*.
  - Fallback a WhatsApp cuando no contestan.
- **Límites** ([call logic and limits](https://docs.dapta.ai/llms.txt) [V]):
  - 1 llamada cada 3 s por secuencia.
  - Máximo 5 intentos por día por contacto, con 1 h entre intentos.
  - Concurrencia: 1 en Free, 5 en Pro, 20 en Scale-Up.
  - Teléfonos en formato E.164.
  - Los números de Colombia los gestiona Soporte (US$28/mes); no son self-service.

### 1.3 Interfaz técnica (cómo nos integramos)

```
Nuestra plataforma ──POST──▶ Flow Studio "Public Route" (URL con auth embebida = secreto)
                                 │
                                 ├─▶ Nodo "Add Contact To Sequence" (secuencia del agente calificador)
                                 └─▶ Nodo "Dapta Phone Call" (From, To E.164, agente, {{variables}})
                                                │
                       Llamada ─▶ Post-call analysis ─▶ Webhook POST a nuestro endpoint
                                                          { event, call:{call_id, to_number, ...},
                                                            call_analysis:{call_summary,
                                                              custom_analysis_data:{<variables>}},
                                                            recording_url }
Lectura complementaria: MCP https://mcp.dapta.ai/mcp (x-api-key) → list_calls, get_call,
                        export_calls, find_qualified_leads, get_my_balance  (60 calls/min)
```

- **No existe una API REST pública ni un SDK** para crear leads o llamadas. La propia documentación lo dice [V].
- **El esquema del webhook post-llamada está incompleto:** no documenta la ruta de la transcripción, el estado de la llamada ni el costo. La documentación recomienda inspeccionar una ejecución real [V]. **Hay que probarlo el primer día.**
- **Las escrituras por MCP son en dos pasos** (`preview_*` → `commit_*` con un token de un solo uso) [V]. Encaja bien con un patrón de *human-in-the-loop*.
- **No hay sandbox oficial** [V]. El reto dice que los organizadores darán **un entorno de prueba con un agente calificador**. Tenemos que confirmar cómo recibe los leads.

### 1.4 Costos (claves para el CPL)

| Concepto | Costo | Fuente |
|---|---|---|
| 1.000 créditos | US$1 | [V] [how credits work](https://docs.dapta.ai/llms.txt) |
| Llamada contestada | 333 créditos/min (redondea al minuto) ≈ US$0,333/min | [V] |
| Buzón de voz / sin respuesta / fallida | 75 / 45 / 0 créditos | [V] |
| Mensaje IA (texto) | 40 créditos, más la tarifa de Meta por WhatsApp | [V] |
| Ejecución de Flow Studio | 1 crédito, más el costo del modelo ×2 en nodos IA | [V] |
| Planes | Pro US$99 (100k créditos), Scale-Up US$499, Prime US$1.499 | [V] [pricing](https://dapta.ai/pricing/) |
| Número Colombia | US$28/mes | [V] |

**Ejemplo [H]:** una llamada calificadora de 2 minutos cuesta US$0,67. Si 1 de cada 4 intentos contesta, cada lead contactado por voz cuesta unos US$0,80 solo en minutos, antes de prorratear el plan y el número.

### 1.5 Qué NO hace Dapta (nuestro espacio)

- **No busca, descubre ni enriquece leads a escala** [V].
  - Lo más cercano es la función "Web Research" de Dapti: investigación puntual de una URL, no prospección [V].
  - La landing de Dapti menciona enriquecimiento desde fuentes públicas, sin detalle técnico [V/NC].
- **No mide el costo por fuente de prospección** ni compara la calidad entre canales de origen [H, no encontramos evidencia de que exista].
- **Nuestra lectura [H]:** si Dapta avanza hacia el pago por reunión calificada, le conviene saber **qué fuentes producen leads que su agente califica**. Nuestro producto le da esa métrica.

---

## 2. Estado de la tecnología relevante

| Área | Opciones | Madurez | Lo que significa para nosotros |
|---|---|---|---|
| Voz en tiempo real | OpenAI gpt-realtime, Gemini Live, ElevenLabs Agents, Retell, Vapi, LiveKit Agents, Pipecat (Smart Turn v3) | Estable / reciente | **No construimos voz propia.** Dapta es la capa de voz; competir con ella resta puntos. Costo de referencia del mercado: US$0,10–0,35/min [NC], en línea con Dapta. |
| Agentes con herramientas | Claude (web search US$10/1k búsquedas, `user_location: CO`, web fetch) [V], Claude Agent SDK, OpenAI Agents SDK, LangGraph | Estable | Útiles para **enriquecer y explicar** cada lead ("por qué este lead", con evidencia citada). No hace falta un framework pesado: un orquestador simple con 3–4 herramientas basta. |
| Protocolos | MCP (Linux Foundation, dic-2025) [V], A2A (Linux Foundation) [V] | Estable / reciente | **El MCP de Dapta tiene valor real** para leer resultados. Exponer nuestro propio MCP ("Dapti, búscame clínicas en Medellín") es un buen *stretch goal*. A2A solo sirve para la narrativa. |
| Extracción estructurada | JSON Schema / Zod / Pydantic con salidas estructuradas | Estable | Clasificar el ajuste al perfil de cliente ideal y extraer señales de la web corporativa. |
| Deduplicación | Cascada: NIT → teléfono E.164 (libphonenumber) → dominio (tldextract) → nombre normalizado (rapidfuzz) + geo. Splink si escala | Estable | El NIT nos da una **llave fuerte**, una ventaja colombiana: SECOP, RUES y Supersociedades lo comparten. |
| Observabilidad | Langfuse (open source, plan gratis) [NC], OpenTelemetry GenAI (en desarrollo) | Estable / experimental | Las trazas nos dan el **costo real de LLM por lead**, uno de los insumos del CPL. |
| Despliegue | Next.js + Vercel; Supabase Free (500 MB, se pausa tras 7 días inactivo) [V]; Trigger.dev / Inngest para jobs [V/NC] | Estable | Los jobs largos (búsqueda, espera de webhooks) **no** van en funciones serverless simples. |

**Referencia de hackathon:** *SalesShortcut* ganó el gran premio del ADK Hackathon de Google (sep-2025). Es un SDR multiagente con voz (ElevenLabs), email y A2A ([Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/adk-hackathon-results-winners-and-highlights) [V]). Muestra que "SDR multiagente" **ya no es novedoso por sí solo**. Tenemos que diferenciarnos en contexto (Colombia y cumplimiento), en medición (CPQL) y en calidad de la señal.

**Lecciones del mercado de AI SDR** (11x, Artisan):
- TechCrunch documentó logos falsos, ARR inflado y abandono alto en 11x ([TechCrunch](https://techcrunch.com/2025/03/24/a16z-and-benchmark-backed-11x-has-been-claiming-customers-it-doesnt-have) [V]).
- Las críticas que se repiten son volumen sin calidad, dominios quemados y respuestas por debajo del 1% [NC].

**Implicación:** el jurado probablemente desconfía del "spray and pray". Un producto que mide calidad y cumple la ley se posiciona contra esa tendencia.

---

## 3. Fuentes de datos e integraciones

### 3.1 Fuentes de leads

| Fuente | Qué da | Acceso / costo | ¿Se puede almacenar? | Uso propuesto | Si falla… |
|---|---|---|---|---|---|
| **SECOP II Proveedores** `qmzu-gj57` | NIT, razón social, correo, teléfono, web, municipio, `espyme`, tipo de empresa | Socrata, app token gratis [V] | Sí, CC BY-SA 4.0 [V] | **Fuente principal con contacto.** Bogotá: 20.830 sociedades activas con correo y teléfono; 14.696 son pyme [V] | Descarga CSV del dataset |
| **RUES abierto (Confecámaras)** `c82u-588k` | NIT, CIIU, estado, fecha de renovación, tipo de sociedad. **Sin contacto** | Socrata gratis [V] | Sí [V] | **Filtro por perfil** (CIIU, ACTIVA, antigüedad) y llave de deduplicación | Snapshot local |
| **Supersociedades NIIF** (`6hqw-m3dm`, `pfdp-zks5`, `prwj-nzxa`) | Estados financieros por NIT | Socrata gratis [V] | Sí | Filtro por tamaño o ingresos (empresas medianas) | Opcional |
| **Registro Nacional de Turismo** `thwd-ivmp` | Teléfono, celular, correo | Socrata gratis [V] | Sí | Vertical turismo, si encaja con el perfil | — |
| **Google Places API (New)** | Nombre, tipo, dirección. Teléfono, web y rating **solo con SKU Enterprise** | 1.000 llamadas Enterprise/mes gratis (hasta 20 lugares cada una); luego US$35/1k [V] | **Solo el `place_id`**. Lat/lng hasta 30 días. Prohibido construir una base con contenido de Maps [V] | Fuente para pymes que **no** venden al Estado (clínicas, inmobiliarias). Guardar el `place_id` y consultar el contacto al momento de usarlo | OSM / Overture |
| **OpenStreetMap (Overpass)** | Categoría y ubicación. Contacto escaso: Bogotá 3,5% con teléfono, Medellín 9,9% [V, conteo propio] | Gratis con límites [V] | Sí, pero ODbL *share-alike* [V] | Capa geográfica y de categoría | Overture |
| **Overture Maps Places** | Lugares con teléfonos, webs y redes (unos 81M en el mundo) | Parquet en S3/Azure, gratis [V] | Sí (CDLA-P 2.0 / Apache) [V] | Alternativa almacenable a Google. **No medimos la cobertura en Colombia** | — |
| **Web corporativa** | Email genérico, enlace `wa.me`, teléfono, señales (chat, formulario, horario) | Fetch propio respetando robots.txt | Dato corporativo | **Enriquecimiento y señales** | — |
| Buscadores (Tavily 1k/mes gratis, Serper 2,5k gratis, Exa) | Resultados web | [V] | Según términos (Brave exige plan con derechos de almacenamiento) | Encontrar la web de una empresa a partir de su NIT o nombre | Claude web search |

**Descartadas, por términos o viabilidad:**
- LinkedIn: el punto 8.2 de sus términos prohíbe el scraping [V].
- Scraping de Google Maps, incluido Apify: viola los términos de Google [V].
- Páginas Amarillas: no hay API y no encontramos términos [NC].
- Facebook Pages search: requiere App Review [V].
- Google Custom Search: cerrado a clientes nuevos; se apaga el 1-ene-2027 [V].
- Yelp: sin cobertura en Colombia [V].
- Common Crawl: prohíbe extraer datos personales [V].
- Meta Ad Library API: fuera de la UE solo devuelve anuncios políticos [V]. La señal "anuncios activos" **no** se obtiene legalmente por API.

### 3.2 Canales de contacto

| Canal | Costo | Restricción clave | Viabilidad en el evento |
|---|---|---|---|
| **Voz (Dapta)** | ≈ US$0,333/min contestado [V] | Ley 2300: horario (L–V 7–19, sáb 8–15), no domingos ni festivos; consultar el Registro de Números Excluidos [V]. No está claro si aplica a B2B [NC]; **la aplicaríamos igual** | **Alta.** Es el canal de Dapta y el más demostrable |
| **Email** | Gratis en el free tier (Brevo 300/día [V parcial]; Amazon SES US$0,10/1k [V]) | Resend lo prohíbe [V]. Gmail exige SPF/DKIM, desuscripción en un clic y spam por debajo de 0,3% [V]. Un dominio nuevo necesita calentamiento | **Media.** Dominio propio, volumen bajo, correos corporativos genéricos, opt-out |
| **WhatsApp (Cloud API)** | Marketing ≈ US$0,0125 en Colombia [NC]; respuestas dentro de las 24 h gratis [V] | **Opt-in obligatorio antes del primer mensaje** [V]. Plantillas aprobadas. La verificación del negocio toma tiempo | **Baja como primer contacto.** **Alta como segundo paso:** el lead escribe primero (enlace `wa.me` en el email o la landing) |

### 3.3 Marco legal (Colombia)

- **Ley 1581/2012:** protege datos de **personas naturales** [V]. Un concepto de la SIC deja fuera los datos de personas jurídicas y los corporativos (correo institucional) [V parcial]. **Pero** un correo `nombre.apellido@` o el celular de un representante legal sí son datos personales [H].
- **Decreto 1377/2013:** "dato público" incluye la calidad de comerciante y los datos de registros públicos [V]. Que algo sea accesible no lo vuelve público automáticamente [NC].
- **Ley 2300/2023:**
  - Exige autorización previa para publicidad por SMS, mensajería, email y llamadas; un contacto al día como máximo y no repetir por otro canal en la misma semana; con horarios fijos [V].
  - Cuando el destinatario es una pyme, no está claro si cuenta como "consumidor" [NC].
- **Circular SIC 1/2024:** hay que consultar el Registro de Números Excluidos (CRC) antes de enviar publicidad [V].
- **Registro Nacional de Bases de Datos:** no aplica a una startup pequeña (umbral de 100.000 UVT en activos) [V].

**Reglas de diseño que salen de aquí [H, validar con los organizadores]:**
1. Solo personas jurídicas. Excluir `PERSONA NATURAL` y los campos del representante legal.
2. Procedencia y licencia **por campo**.
3. Filtro de horario legal y límite de un contacto por semana entre todos los canales.
4. Opt-out en todo mensaje, con identificación clara del remitente y de la fuente del dato.
5. WhatsApp solo después del opt-in.
6. No almacenar contenido de Google Places distinto del `place_id`.
7. Política de tratamiento de datos publicada.

---

## 4. Oportunidades de producto (ángulos sobre el reto)

Todas cumplen los requisitos obligatorios. Se diferencian en **qué hacen excepcionalmente bien**.

### A. Radar de señales: leads con evidencia de dolor
- **Qué es:** prioriza pymes con señales públicas de que necesitan lo que Dapta vende:
  - horario limitado;
  - web sin chat ni WhatsApp, solo formulario;
  - categoría de alto volumen de llamadas (clínicas, odontología, inmobiliarias, educación, concesionarios);
  - vacantes de "asesor comercial".
- **Cada lead trae su "por qué"**, con evidencia citada.
- **Hipótesis [H]:** los leads con señal se califican mejor en Dapta → CPQL más bajo.
- **Riesgo:** las señales más fuertes (reseñas "no contestan", anuncios activos) no se obtienen legalmente por API (Places limita el almacenamiento; Ad Library API no cubre Colombia). Hay que usar señales legales, más débiles.

### B. Laboratorio de canales: dónde conviene buscar, con números honestos
- **Qué es:** trata cada *fuente × canal de contacto* como un brazo de un experimento. Mide el embudo completo: encontrado → ajusta al perfil → contactado → respondió → calificado por Dapta.
- **Calcula tres costos por brazo:**
  - CPL;
  - costo por respuesta;
  - **CPQL**, con un modelo de costos explícito: variable (datos, LLM, envío, minutos) + fijo prorrateado (plan Dapta, número, dominio) + opcional el tiempo humano.
- **Recomienda dónde invertir el siguiente esfuerzo** y muestra la **incertidumbre** (intervalos), porque con una n pequeña no se debe sobre-concluir.
- **Por qué gana:** responde literalmente la frase del reto ("para saber dónde conviene buscar"). Encaja con el pago por resultados de Dapta.
- **Riesgo:** con pocas horas de evento, las respuestas reales serán pocas → hay que diseñar bien la demo.

### C. Prospección con cumplimiento por diseño
- **Qué es:** un filtro de cumplimiento antes de cada contacto (horario, Registro de Números Excluidos, límite entre canales, opt-out, persona natural sí/no). Cada dato lleva su procedencia y licencia.
- **Por qué importa:** es un requisito explícito del reto ("respetando términos… y ley de protección de datos"), poco común en la competencia, y con una ventaja local real.
- **Riesgo:** sola es una capa, no un producto. Brilla combinada con B.

### D. Diagnóstico gratuito como gancho (outreach que aporta valor)
- **Qué es:** en lugar de un "hola, ¿te interesa?", cada lead recibe un enlace a una **mini-auditoría personalizada**: "Tu negocio atiende 45 h/semana; un agente de voz cubriría las 123 h restantes", con su web y su categoría analizadas.
- El CTA es "habla con nuestro agente" (web call o `wa.me`) → **opt-in legal** → el agente calificador de Dapta.
- **Por qué gana:** resuelve el problema del opt-in de WhatsApp y del cold email, sube la tasa de respuesta [H] y es muy memorable en la demo.
- **Riesgo:** más trabajo de frontend; la "auditoría" no puede inventar cifras.

### E. Prospector nativo para el ecosistema Dapta (MCP)
- **Qué es:** exponer la búsqueda como un servidor MCP o un flow, para que un cliente de Dapta le pida a Dapti: "consígueme 50 clínicas odontológicas en Medellín que no tengan WhatsApp" → se cargan en una secuencia.
- **Por qué gana:** es la integración más profunda posible con Dapta; se ve como una funcionalidad que Dapta podría lanzar mañana.
- **Riesgo:** depende de que Dapti pueda conectarse a MCPs externos [NC]; el jurado podría verlo como "una feature, no un producto".

---

## 5. Matriz comparativa (1–5, con justificación)

| Criterio (peso) | A Señales | B Laboratorio | C Cumplimiento | D Diagnóstico | E MCP nativo |
|---|---|---|---|---|---|
| Impacto en el problema del reto (20%) | 4: mejora la calidad | **5**: responde "dónde buscar" | 3: habilita, no resuelve | 4: mejora la respuesta | 3 |
| Novedad (15%) | 4 | 4: nadie mide CPQL por fuente orgánica [H] | 3 | **5** | 4 |
| Viabilidad en el evento (15%) | 3: señales legales limitadas | 4 | **5** | 3: frontend extra | 2: dependencia no confirmada |
| Diferenciación vs. SDRs existentes (15%) | 4 | **5** | 4: ventaja local | 4 | 3 |
| Uso significativo de Dapta (15%) | 3 | **5**: Dapta es el árbitro de calidad | 2 | 4 | **5** |
| Calidad potencial de la demo (10%) | 4: el "por qué" se ve bien | 4: tablero vivo | 2 | **5** | 3 |
| Potencial de crecimiento (10%) | 4 | **5**: base de un modelo por resultados | 3 | 4 | 4 |
| **Total ponderado** | **3,70** | **4,60** | **3,20** | **4,10** | **3,40** |

Los pesos son una propuesta **para discutir en la sesión 1**. Si el jurado premia sobre todo la demo, D sube.

---

## 6. Recomendación preliminar

**Idea principal: B como columna vertebral, con A y C integrados.** Nombre de trabajo: **"Faro"**.

> *Faro encuentra clientes para tu pyme en fuentes públicas, los contacta legalmente y te dice qué fuente y qué canal te dan leads calificados al menor costo, con Dapta como juez de calidad.*

**Por qué:**
1. **Ataca la frase central del reto** ("para saber dónde conviene buscar") con la métrica que importa (CPQL), no con la fácil (CPL de datos casi gratis).
2. **Dapta es esencial, no decorativo.** Su agente calificador es el *ground truth* de calidad. Sin Dapta, el producto solo mide volumen.
3. **Honestidad como diferenciador.** El modelo de costos explícito, los intervalos de incertidumbre y el cumplimiento visible van contra el "spray and pray" que el mercado ya critica.
4. **Viable:**
   - Las fuentes principales (SECOP + RUES) tienen API gratuita, licencia abierta y la llave NIT.
   - Google Places complementa a las pymes que no venden al Estado.
   - Voz por Dapta y email con un dominio propio cubren el contacto.

**Alternativa:** D (diagnóstico gratuito). Si los organizadores confirman que los leads reales **no** se pueden contactar en frío, o el jurado pesa mucho la demo, D resuelve mejor el opt-in. **Las dos ideas no se excluyen:** la landing de diagnóstico de D puede ser un "canal" más dentro del laboratorio B, y así medimos si aportar valor baja el CPQL. Esa combinación es la apuesta más fuerte si el tiempo alcanza.

**Lo que NO recomendamos:** construir voz propia, montar un sistema multiagente complejo "porque sí", o scrapear Maps o LinkedIn (incumple los requisitos del reto).

**Definiciones que proponemos fijar desde ya (ADR-002):**
- **Lead encontrado:** empresa única tras deduplicar, de cualquier fuente.
- **Lead del perfil:** encontrado y que pasa el filtro del perfil de cliente ideal.
- **Contactado:** se le envió al menos un mensaje real.
- **Respondió:** hubo una respuesta registrada.
- **Calificado:** Dapta lo marcó como calificado.
- **CPL(fuente)** = costo atribuible a la fuente ÷ leads del perfil de esa fuente.
- **CPQL(fuente, canal)** = costo total atribuible ÷ calificados por Dapta.
- **Regla de atribución** para leads que aparecen en varias fuentes: primera fuente / todas, por definir.

---

## 7. Riesgos, restricciones y preguntas

### 7.1 Preguntas para los organizadores (bloqueantes)
1. **El agente calificador de Dapta:**
   - ¿Cómo recibe los leads? ¿URL de Public Route, secuencia o MCP?
   - ¿Califica **llamando** al lead o **analizando datos** que le enviamos?
   - ¿Qué variables devuelve? ¿Cuántos créditos tenemos? ¿Hay número colombiano?
2. **Las 50 empresas de ejemplo:** ¿son reales? ¿Aceptaron que las contactemos? Si es así, son nuestro banco de pruebas de contacto **real y legal**.
3. **Leads reales del evento:** ¿se espera que los **contactemos de verdad** o basta con contactar las 50 de ejemplo y dejar el resto listo? ¿Por qué canales y con qué volumen máximo?
4. **"Canal" en la métrica:** ¿es la fuente donde se busca, el canal de contacto o ambos? ¿Qué costos cuentan: solo dinero o también el tiempo?
5. ¿Cuál es el perfil de cliente ideal exacto y la lista de fuentes sugeridas? ¿Hay vertical o ciudad preferida?
6. **Formato del evento:**
   - ¿Cuánto dura, cuántas personas por equipo y cómo se reparten los pesos de evaluación?
   - ¿Hay que mostrar el producto en vivo frente al jurado?
   - ¿Los leads tienen que encontrarse *durante* el evento?

### 7.2 Preguntas para el equipo
- ¿Cuántas personas somos, con qué habilidades y cuántas horas tenemos?
- ¿Tenemos un dominio propio para email (no el corporativo de nuestra empresa)?
- ¿Preferencia de stack? Propuesta inicial: TypeScript, Next.js y Postgres (Supabase).

### 7.3 Riesgos principales

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Pocas respuestas reales en las horas del evento → CPQL con n pequeña | Alta | Alto | Contactar temprano; usar las 50 de ejemplo; mostrar intervalos; separar con claridad lo real de lo proyectado |
| Webhook post-llamada de Dapta con esquema distinto al esperado | Media | Alto | Prueba de integración el día 1; guardar el payload crudo; mapeo configurable |
| Cold email bloqueado o en spam (dominio nuevo) | Alta | Medio | Volumen bajo, SPF/DKIM/DMARC, correos genéricos corporativos; voz como canal principal |
| WhatsApp no habilitado a tiempo (verificación de Meta) | Alta | Medio | WhatsApp solo como canal de respuesta (`wa.me`); no depender de la Cloud API para el primer contacto |
| Interpretación legal (Ley 2300 en B2B, datos SECOP con finalidad distinta) | Media | Alto | Filtro de cumplimiento conservador; solo personas jurídicas; validar con los organizadores |
| Términos de Google Places (almacenamiento) | Media | Medio | Guardar solo el `place_id`; consultar el contacto al momento de usarlo |
| Supabase Free se pausa / límites | Baja | Medio | Keep-alive o plan Pro durante el evento |

### 7.4 Lo que NO pudimos confirmar
- La tarifa oficial de WhatsApp para Colombia (está en el rate card de Meta).
- Los términos de Brevo sobre cold email.
- La cobertura de Overture y Foursquare en Colombia.
- El texto literal de los términos 3.2.3 de Google Maps.
- Si Dapti puede usar MCPs externos.
- El esquema completo del webhook de Dapta.
- El modelo de pago por resultados de Dapta como producto disponible.

---

## 8. Plan para la siguiente sesión (sesión 1: problema, propuesta de valor y definiciones)

**Duración:** 60–90 min. **Entrada:** este informe y las respuestas de los organizadores a la sección 7.1.

| Bloque | Tiempo | Decisión que sale |
|---|---|---|
| 1. Respuestas de los organizadores | 15 min | Cómo recibe leads el calificador; si se puede contactar a leads reales; definición de "canal" |
| 2. Elegir el ángulo | 20 min | B+A+C, o B+D. Ajustar los pesos de la matriz |
| 3. Fijar métricas y modelo de costos | 20 min | Definiciones del embudo, CPL, CPQL y atribución |
| 4. Fijar fuentes y canales del MVP | 15 min | Fuentes: SECOP + RUES + Places (¿+ web corporativa?). Canales: voz (Dapta) + email (+ `wa.me` como respuesta) |
| 5. Elegir vertical y ciudad para la demo | 10 min | P. ej. clínicas odontológicas o inmobiliarias en Bogotá o Medellín, según el perfil |

**Entregables de la sesión:**
- `docs/adr/ADR-001-alcance-y-angulo.md`
- `docs/adr/ADR-002-metricas-y-modelo-de-costos.md`
- `docs/adr/ADR-003-fuentes-canales-y-cumplimiento.md`
- Resumen de decisiones, supuestos pendientes, riesgos y siguientes tareas.

**Tareas antes de la sesión (paralelizables):**
1. Enviar las preguntas de la sección 7.1 a los organizadores.
2. **Prueba técnica de Dapta (spike):** crear un flow con Public Route → Add Contact To Sequence → webhook post-llamada hacia un endpoint de prueba (p. ej. webhook.site). Guardar el payload real.
3. **Prueba técnica de datos (spike):** consulta a SECOP `qmzu-gj57` + RUES `c82u-588k` filtrada por los CIIU del perfil, con conteo de leads con contacto y unión por NIT.
4. Verificar la tarifa de WhatsApp para Colombia y los términos de Brevo y Amazon SES sobre cold email.
