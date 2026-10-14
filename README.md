# LPApp – Layered Process Audit (Mitchell Plastics)

PWA móvil (Next.js 14 + PostgreSQL) para ejecutar LPAs desde el teléfono. Basada en el módulo LPA de QualityShield
y en el programa semanal de la planta (Layer 1 / 2 / 3).

## Cómo funciona
- **Capas:** Layer 1 (QE, PE, supervisores, OJT, mold tech, paint, logística/shippers, RH) audita en un **día fijo**;
  Layer 2 y 3 (gerentes / GM) hacen **una auditoría por semana en "All Areas"** (vence el viernes).
- **El área rota, el día no:** cada auditor tiene `days` fijos y un `pool` de áreas; cada lunes avanza a la siguiente
  (PE puede rotar también cada día). La semana de referencia es la de la foto (5-Oct-2026).
- **Preguntas por rol:** 24 plantillas importadas de QualityShield (441 preguntas). Cada auditoría toma una ventana de
  N preguntas (default 10) que va rotando para cubrir todo el banco. Editable en Admin → Preguntas.
- **Resultados:** ✓ OK / ✕ No cumple / Δ Parcial / N/A. X y Δ exigen comentario, aceptan acción inmediata y foto.
  Score = OK / (OK + X + Δ). Cada X o Δ abre un **hallazgo** (7 días de compromiso) con responsable, acción y cierre.
- **Roles (de mayor a menor):**
  - **Máster** (global, sin planta): ve todas las plantas con el selector del encabezado, **activa y pausa las plantas**, da de alta a los administradores y administra el banco de preguntas (es el mismo para todas). Es el usuario `admin` creado con `ADMIN_PASSWORD`.
  - **Administrador** (de una planta): gestiona **usuarios y roles** de su planta, contraseñas, importaciones, asignaciones de zona y N/P, y ve el Panel, la Semana completa, los Issues y la TV de **su** planta. No puede activar plantas, crear máster, tocar otras plantas ni editar preguntas.
  - **Líder y auditor**: solo ven su información (sus auditorías, su semana y los issues propios o a su cargo). `lead` hoy se comporta igual que `auditor`.
  - Máster y administradores **no audita**n: no se les programan auditorías.
- **Capas:** de Layer 1 a **Layer 4**. Layer 1 audita un día fijo; Layer 2, 3 y 4 hacen una auditoría semanal en "All Areas".
- **Panel:** cumplimiento por capa/depto/semana, áreas con menor score, preguntas que más fallan, faltantes.
- **Ventana de registro:** una auditoría solo se puede hacer **el mismo día programado**
  (Layer 2/3, que es semanal: de lunes a viernes). Después queda como **No realizada** y el servidor rechaza el envío.
- **Pantalla TV:** `/tv?key=TV_KEY` para la pantalla de planta (sin login; refresca cada minuto y rota páginas cada 10 s).
  Muestra a quién le toca hoy, lo completado hoy, gerencia semanal, quién no la hizo y cumplimiento por capa.
  Líderes/admins también la abren desde Panel → "Abrir LPA TV".
- Borrador local: si se pierde señal a media auditoría, las respuestas se conservan en el teléfono.

## Variables de entorno
| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres (Railway la inyecta) |
| `SESSION_SECRET` | string largo aleatorio (obligatorio en producción) |
| `MULTI_SITE` | (opcional) `true` para activar varias plantas; por defecto operas solo MPQ |
| `ADMIN_PASSWORD` | contraseña del usuario `admin`, que es el **máster** (mín. 8 caracteres); se crea en el primer arranque. En despliegues anteriores, el `admin` existente pasa a máster solo |
| `SEED_PASSWORD` | (opcional) contraseña temporal común de los usuarios sembrados. Sin ella, cada usuario nace con una contraseña aleatoria y el admin asigna la de cada quien en Admin → Usuarios |
| `TV_KEY` | clave para la pantalla LPA TV (`/tv?key=…`); sin ella, la TV solo abre con sesión de líder |
| `LPA_GO_LIVE` | (opcional) fecha `YYYY-MM-DD` de arranque; antes de ella no hay "faltantes". Default: día del primer arranque |

## Desarrollo / Railway
```
npm install
cp .env.example .env   # y exporta las variables
npm run build && npm start   # start corre scripts/setup.js (migraciones + seed idempotente) y luego next start
```
En Railway: servicio Node + plugin PostgreSQL, build `npm run build`, start `npm start`.

## Una sola planta (MPQ) y cómo expandirse
**Hoy LPApp opera solo con MPQ.** Todo lo de varias plantas (selector, pestaña Plantas, etiquetas de planta, rol Máster) está **oculto** mientras `MULTI_SITE` no sea `true`. Con una planta, tu usuario `admin` se ve y funciona como **Administrador**, y los usuarios nuevos se crean en MPQ automáticamente.
La base de datos y el código ya traen la estructura de plantas (MPQ, MPS, MPC, UMW y MPD; solo MPQ está activa), así que **para expandirte** basta con poner `MULTI_SITE=true` en las variables de Railway: aparecen el selector, Admin → Plantas (activar con fecha de arranque, importar sus usuarios), el rol Máster y todo queda aislado por planta. No hay que migrar datos.
Variable opcional `HOME_SITE` (por defecto `MPQ`) = la planta que se usa mientras sea una sola.

## Guía de uso
La primera vez que alguien entra (ya con su contraseña propia) ve una guía corta según su rol; se puede reabrir con el botón **?** del encabezado.

## Asignaciones (zona / máquina)
El auditor **no elige nada**: solo ve lo que le asignaron. En **Admin → Asignaciones** el admin carga, por persona y por día de la semana,
la **zona** a inspeccionar y el **número de parte** (la zona viene sugerida por la rotación y se puede cambiar; "Igual toda la semana" copia el primer día
a los demás). Solo el admin puede cambiar zona, número de parte o auditor de una auditoría pendiente; los líderes ya no pueden reasignar.
**Solo Layer 1** lleva zona o máquina asignada por el admin; al **iniciar** la auditoría (Layer 1 y QEs) el auditor captura: **zona** (A1, A2, B1, B2, C1, C2, C3, D1, D2, E2, PL1, PL3, PL4) → **máquina** (no aplica en PL1/PL3/PL4; botones sugeridos más texto libre) → **número de parte**, con un segundo N/P opcional para piezas espejo RH / LH. Se guardan en `audits.zone`, `machine` y `part_number` ("RH / LH"). Layer 2, 3 y 4 auditan "All Areas" sin N/P: al iniciar **escogen el área que auditan**.
La pantalla de Asignaciones es una **tabla semanal** (persona × Lun–Vie, como el programa en papel) con un contador "X de Y asignadas". "Pegar desde Excel" acepta la tabla tal cual: `Nombre, Lun..Vie` (solo zona) (una zona o máquina por día).
Para cargar muchos de una vez: **Pegar desde Excel** (columnas `Nombre, Día, Zona, No. de parte`; sin día = todos los días de la semana). Revisa los avisos por fila y los cambios quedan en la tabla hasta que pulses Guardar.
El número de parte se muestra en Hoy, en la auditoría, en Semana, en Issues y en la pantalla TV.

## Modo claro / oscuro
Todas las pantallas (incluido el inicio de sesión y la pantalla TV) tienen modo **claro** y **oscuro**. Botón sol/luna junto al "?" del encabezado (en el login, junto a ES/EN; en la TV, junto a los filtros). La primera vez sigue la preferencia del teléfono o la computadora, y la elección se guarda en ese dispositivo. La TV arranca oscura si no hay una elección guardada. Los PDF siempre salen en claro.

## Inicio de sesión
En computadora ocupa toda la pantalla (foto de planta, marca, cuatro beneficios y tarjeta flotante); en celular es la versión vertical. **Recordar mi sesión** (marcado por defecto) mantiene la sesión 14 días; sin marcar, se cierra al cerrar el navegador y vence a las 12 h. **¿Olvidaste tu contraseña?** indica que el admin la restablece en Admin → Usuarios (la app no envía correos).

## Panel: resultados y Open issues PDCA
Al final del **Panel** (líderes y admin, solo de su planta) hay dos bloques, como el resumen LPA del Excel:
- **Gráfica de pastel** con el % de respuestas **OK, N/A, Puede mejorar (Δ) y No OK (X)** del periodo elegido (1, 4, 8 o 12 semanas), con la tabla de conteos y porcentajes.
- **Open issues · PDCA**: todos los hallazgos abiertos (vencidos primero) con fecha, ubicación (zona + N/P), hallazgo, responsables y acción, fecha compromiso y un avance
  **P** hallazgo registrado · **D** acción en ejecución · **C** todos los responsables terminaron · **A** cerrado.

**Pantalla TV (`/tv`):** diseño oscuro tipo tablero — indicadores con anillos y cambio contra la semana anterior, pestañas por capa con conteo, "Le toca hoy" con avatares, completadas, no realizadas y cumplimiento por capa. En celular es de una columna con "Ver todas"; en pantalla grande (≥1200 px) rota las listas solas cada 10 s.

**Usuarios al corriente:** % de los usuarios activos de la planta (con auditorías asignadas) que completaron al menos una auditoría en el periodo y no tienen ninguna vencida sin hacer. Sale como indicador en el Panel, con barra junto al pastel y en el reporte PDF.

**Descargar PDF:** el botón sobre la gráfica genera un reporte (encabezado con logo y planta, indicadores, pastel y open issues en tabla, en hoja carta/A4 horizontal). Usa la impresión del navegador: en computadora elige "Guardar como PDF"; en iPhone, Compartir → Guardar en Archivos.

## Preguntas en español e inglés
Todas las preguntas se muestran en **español (arriba) e inglés (abajo)**: al contestar, en los resultados, en los issues y en el Panel.
El banco completo está traducido en `data/question-i18n.json`; al arrancar, `npm start` convierte las preguntas existentes (idempotente) y las nuevas instalaciones ya nacen bilingües.
En Admin → Preguntas, cada pregunta nueva pide los dos idiomas y "Editar" permite corregir ambos. Las respuestas ya registradas antes del cambio conservan su texto original.

## Contraseñas
Cada persona entra con `nombre.apellido` y su **contraseña** (mín. 8 caracteres). El admin la asigna o restablece en Admin → Usuarios; al primer ingreso el sistema obliga a cambiarla.

## Roster
`data/roster.js` se transcribió de la foto del programa. **Verifica nombres, días y áreas** (Admin → Usuarios y rotación).
Usuarios = `nombre.apellido` sin acentos (ej. `luis.rangel`).

## Open issues (hallazgos)
- Cada X / Δ abre **de inmediato** un open issue (`OI-0001`…) al enviar la auditoría.
- El auditor puede agregar **uno o varios responsables** en la misma pantalla del hallazgo; después también pueden agregarse desde Issues (líder, quien levantó el issue o un responsable).
- Cada responsable da **seguimiento por su cuenta** (En proceso / Terminé mi parte, con acción obligatoria) y el issue se **cierra solo** cuando todos terminaron. Hay bitácora con comentarios y un líder puede cerrar/reabrir, quitar responsables o mover la fecha compromiso (+7 días por defecto).
- La pestaña **Issues** muestra una insignia con lo que tienes a cargo; el inicio lista los más urgentes; los líderes tienen la vista "Sin responsable".

## Estadísticas de tiempo (solo admin)
Admin → **Tiempos**: hora de registro, duración activa (pantalla abierta, sin pausas > 60 s), hora típica por auditor, histograma por hora y marca "muy rápida" (< 5 s por pregunta). Las auditorías previas a esta función no traen duración.

## Avisos al administrador
Si una auditoría se termina con menos de **10 minutos de tiempo activo**, se crea un aviso para el administrador de esa planta (campana 🔔 en la cabecera, con contador de nuevos). Al abrirla se marcan como leídos y cada aviso lleva a la auditoría. El umbral es `MIN_SEC` en `app/api/audits/[id]/submit/route.js`.

## QEs · Auditorías de proceso
Los QEs (Calidad, Layer 1) tienen **2 auditorías de proceso al día**, fijas en **Hoy → Por realizar** (sin pestaña aparte), de lunes a viernes, con las preguntas de la plantilla *Process Audit*. Son aparte de su LPA: no cuentan en el Panel, la TV, Semana ni en los cumplimientos de LPA. Al terminar el auditor escoge el **área auditada**; los hallazgos (X / Δ) se abren en **Issues** igual que en cualquier auditoría. En la base se guardan en `audits` con `kind='process'` y `slot` 1 o 2.
El administrador ve el avance en **Admin → QEs**: por semana y por persona, hechas/programadas, promedio, hallazgos, tiempo promedio, no realizadas y un punteo por día (2 puntos por día).
**Pantalla TV de QEs:** `/tv/qes?key=TU_TV_KEY&site=MPQ` (misma llave `TV_KEY` que la TV normal; también abre con sesión de admin). Muestra cumplimiento de la semana, completadas hoy, score promedio, no realizadas, hallazgos, el estatus de Proceso 1 y Proceso 2 de cada QE hoy, y el avance semanal. Se refresca cada minuto y rota por páginas en pantalla grande.

Las auditorías de proceso de los QEs **solo aplican a MPQ** y el administrador define cuántas hace cada QE al día (0 a 5) en **Admin → QEs** (por defecto 2). Al bajar el número se quitan las pendientes de hoy en adelante que sobran; al subirlo se generan las nuevas. También aparecen en **Mi semana** del QE.

**Pantalla "Antes de empezar":** todas las auditorías empiezan con tarjetas de zona (A1…E2, PL1/PL3/PL4). Layer 1 y QEs siguen con máquina (botones, salvo PL) y número de parte (con segundo N/P para piezas espejo); Layer 2, 3 y 4 (All Areas) solo escogen el área que auditan y comienzan.

**Reporte de auditoría de proceso (QEs):** al terminar una auditoría de proceso, el QE puede **descargar un reporte de media hoja** (carta/2, PDF desde el diálogo de impresión): resumen (auditor, fecha, zona/máquina, N/P, score) y, si no hubo hallazgos, "No hay hallazgos"; si los hubo, por cada uno el ítem, el hallazgo, la acción correctiva y la foto. También está disponible en la auditoría ya completada (`/audit/ID/report`).

**Auditoría de proceso de los QEs:** usa la plantilla `QE Process Audit` (formato *QE Layer 1 Audit*, `data/qe-process.json`): 19 preguntas con el **número de ítem** del formato (1033, 1341, 2290, 106, 1031, 100, 1032, 173, 2102, 1042, 453, 2304, 455, 458, 459, 448, 449; las 2 primeras de Plan de Control no llevan número), en español y luego inglés. Cada auditoría lleva las 19 (se puede cambiar en Admin → Preguntas). El ítem se muestra arriba de cada pregunta y en el hallazgo del reporte.
