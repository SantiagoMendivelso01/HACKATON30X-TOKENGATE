# Sesión grill-me 2: propuesta de valor y métricas

**Fecha:** 16-oct-2026 · **Participantes:** equipo · **Estado:** cerrada

## Decisiones tomadas

| # | Pregunta | Decisión | Descartado y por qué |
|---|---|---|---|
| D14 | Precio de cada acción | **Precio de lista por unidad** en cada asiento, como si no hubiera free tier. Aparte se muestra el **gasto real de bolsillo** | "Solo gasto real": casi todo da $0 y no permite comparar. "Free tier prorrateado": depende de supuestos de volumen |
| D15 | Costos fijos | **Dos vistas:**<br>• *Variable* (principal, para comparar canales).<br>• *Total*: fijos prorrateados por los días de la campaña. Los exclusivos de un canal van a ese canal (número Dapta → voz, dominio → email) y los compartidos (plan Dapta) se reparten por contactos.<br>La vista activa siempre está a la vista | "Solo variable" subestima la voz. "Una cifra total": los fijos tapan la diferencia entre canales con volumen bajo |
| D16 | Tiempo humano | **Se mide automáticamente** (minutos en las pantallas de aprobación y revisión, atribuidos a los leads del lote). Se muestra como *minutos humanos por lead* y se puede sumar al costo con una tarifa configurable; **apagado por defecto** | Excluirlo esconde el costo de revisar el diagnóstico. Incluirlo por defecto deja que una tarifa supuesta domine el número |
| D17 | Lead encontrado por las dos fuentes | **Experimento:** se sortea entre las fuentes que lo encontraron. **"Dónde buscar":** cada fuente muestra un *CPL bruto* (costo ÷ todos sus leads del perfil) y un *CPL incremental* (costo ÷ leads que solo ella aportó) | "Primera fuente": el orden de ejecución sesga. "Excluir compartidos" pierde leads y muestra |
| D18 | Moneda | **COP principal, USD secundaria.** TRM del día de la campaña, fija y registrada en cada asiento. *Decidida sin consulta por ser reversible* | — |
| D19 | Referencia de comparación | **El CPL de pauta del cliente,** que se ingresa al crear la campaña. En la demo, un valor de los organizadores o Dapta; si no lo hay, US$10,78 (Meta, Colombia) **marcado "referencia externa, no verificada"** | Una cifra pública fija arriesga la credibilidad. Sin referencia se pierde el argumento económico |
| D20 | Frase de recomendación (idea 8) | **LLM con verificación:** cada número de la frase debe coincidir con el cálculo. **Respaldo obligatorio con la plantilla determinista** si la verificación falla o el LLM tarda. La frase se genera cuando cambian los números (cierre de oleada o resultados maduros) y queda guardada | *Decisión del equipo frente a la recomendación de usar solo plantilla.* El LLM libre puede contradecir los números |
| D21 | Propuesta de valor | **Lema:** "No te decimos cuánto cuesta un lead. Te decimos cuánto cuesta uno que vale la pena."<br>**Descripción:** "Faro busca clientes para tu pyme en fuentes públicas, los contacta respetando la ley, deja que el agente de Dapta los califique y te dice dónde buscar y cómo contactar al menor costo por lead calificado." | "Dejar de adivinar": menos explícita sobre Dapta y la calidad. "Funcional": no se recuerda |

**Ejemplo de contenido de la frase** (ya validado):
> Busca en datos abiertos: cada lead del perfil te cuesta $1.200 COP (incremental). Contacta por voz: 72% de probabilidad de ser el mejor canal. Próxima oleada: 70% voz · 20% email+diagnóstico · 10% email. *Evidencia: débil (38 contactos maduros).*

## Supuestos pendientes de validar
- **S-F:** las tarifas de lista de cada proveedor quedan en `config/rates`, con URL y fecha. Falta la tarifa de email (el proveedor se elige en la sesión 4).
- **S-G:** el webhook de Dapta trae la duración de la llamada; si no la trae, se estima con el redondeo por minuto y el asiento se marca `estimated`.
- **S-H:** los organizadores tienen un CPL de pauta de referencia para la demo.
- **S-I:** el LLM de la frase responde en menos de 10 s; si no, se usa la plantilla.

## Riesgos identificados
- **R5:** la frase redactada por el LLM puede sonar distinta a la plantilla de respaldo. Ambas comparten estructura y datos.
- **R6:** el CPL incremental es inestable si el solapamiento entre fuentes es pequeño. Se muestra con su número de leads.
- **R7:** usar precio de lista puede hacer que la voz se vea "cara" frente a la pauta. Es honesto y es justo lo que el producto debe mostrar.

## Siguientes pasos
- ADR-002 consolidado y aceptado con D6, D7, D12 y D14–D20 (hecho al cerrar esta sesión).
- **Sesión 3: experiencia de usuario.** Pantallas, flujo, qué controla el humano, estados de error, dirección visual y el diagnóstico público. Al cerrarla se reescribe la parte de UX de la definición de producto.
