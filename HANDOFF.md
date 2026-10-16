# LPApp — Documento de traspaso (para reconstruir o continuar la app “igualito”)

> Este documento + el código de este zip + las capturas de `reference-screenshots/` son TODO lo necesario para reproducir la aplicación tal como está hoy.
> El código fuente es la verdad absoluta; este documento explica el **por qué** y las **reglas de negocio** que el usuario fue pidiendo durante la construcción.
> Idioma de la interfaz: **español de México** (las preguntas son bilingües es/en). Zona horaria de negocio: **America/Mexico_City**.
> Rama de trabajo: `claude/new-session-2lw6w5` (repo GitHub `luisrangel2507/AuditAPP`). Producción: Railway (`auditapp-production-f2fc.up.railway.app`).

---------------------------------------------------------------------------------------------------

## 0. Qué es

**LPApp** es una PWA interna de **Mitchell Plastics (planta MPQ, Querétaro)** para ejecutar **Layered Process Audits (LPA)** desde el teléfono (iPhone principalmente) y la computadora, con seguimiento de hallazgos (“Open Issues” / PDCA), reportes, pantallas de TV de planta y administración.
Está basada en el módulo LPA de “QualityShield” (de ahí el banco de 441 preguntas en 24 plantillas) y en el programa semanal de la planta (foto “Programa Auditoría LPA”, semana del 5-oct-2026).

- **Hoy opera solo con MPQ** (`MULTI_SITE` apagado). Existe la estructura para 5 plantas (MPQ, MPS, MPC, UMW, MPD) pero solo MPQ está activa.
- **Piloto:** arrancó el **14-oct-2026** con las **auditorías de proceso de los QEs**. Días anteriores no cuentan (sin rojo / sin “No realizada”). Las LPA “normales” de los demás roles aún no arrancan oficialmente; las LPA de los QEs están **apagadas** (solo hacen auditorías de proceso) y se encienden por usuario o en bloque desde Admin.
- Usuarios reales de prueba mencionados: Luis/Eduardo Rangel (QE, username `luis.rangel`, se ve como “Eduardo Rangel”), David Castillo, Victor Ramírez, Diana Laureano, Edwin Gama, Erika Izquierdo (QEs); Aldo Esquivel (Quality Manager); Adolfo Francisco (Supervisor de Zona E, responsable de issues); Fabiola Marina (Gerente de Logística).

## 1. Stack y cómo correrlo

- **Next.js 15.5 (App Router), React 19**, JavaScript (sin TypeScript), **PostgreSQL** vía `pg`, sesiones **JWT en cookie httpOnly** (`jose`), `bcryptjs`, `web-push` (push), `@zxing/browser` + `@zxing/library` (escáner de códigos), sin librerías de UI (CSS propio en `app/globals.css`, ~1700 líneas).
- `next.config.js`: `serverExternalPackages: ['pg','bcryptjs','web-push']`, cabeceras de caché para imágenes y `/sw.js` sin caché.
- `npm start` = `node scripts/setup.js && next start -p $PORT` → **`scripts/setup.js` crea/migra el esquema de forma idempotente** y siembra datos (plantillas, usuarios, flags de migración única). Nunca hay que correr migraciones a mano.
- `instrumentation.js` → `instrumentation-node.js` arrancan las **tareas programadas** (`lib/jobs.js`) cada 5 min dentro del servidor (candado `pg_advisory_lock`).
- **Variables de entorno:** `DATABASE_URL`, `SESSION_SECRET` (obligatoria en prod), `ADMIN_PASSWORD` (usuario `admin`, mín. 8 caracteres), `SEED_PASSWORD` (contraseña temporal de usuarios sembrados; sin ella nacen con aleatoria), `TV_KEY` (clave de las pantallas TV), `MULTI_SITE` (`true` para varias plantas), `HOME_SITE` (default `MPQ`), `LPA_GO_LIVE` (YYYY-MM-DD), `VAPID_SUBJECT` (opcional; las llaves VAPID se autogeneran y guardan en `settings`).
- **Railway:** servicio Node + plugin PostgreSQL; build `npm run build`; start `npm start`. Tras cada deploy hay que cerrar y reabrir la app (PWA + service worker).
- Reglas de validación de contraseña en `lib/password.js`. Primer ingreso: `must_change` obliga a cambiar contraseña; luego se muestra una guía corta por rol (`components/Guide.js`).

## 2. Estructura del repositorio

```
app/                      páginas (App Router) + app/api/** (rutas de servidor)
  page.js                 Hoy (inicio del auditor / panel del admin)
  week/                   Mi semana
  audit/[id]/             Pantalla de auditoría: inicio, runner por etapas, resultado
  audit/[id]/report/      Reporte (media hoja, imprimible/PDF) de auditoría de proceso
  findings/               Open Issues
  dashboard/              Panel (admin)
  admin/                  Administración (Asignaciones, Usuarios, Preguntas, QEs, Reportes↗, Registro, Plantas)
  reports/, reports/weekly/   Reportes (pareto, repetidos, cumplimiento, respaldo, CSV) y reporte semanal imprimible
  qes/                    Vista de QEs (admin)
  tv/, tv/qes/            Pantallas de TV (LPA general y estatus de auditorías de proceso de QEs)
  login/                  Inicio de sesión
  globals.css             TODO el CSS (tema claro/oscuro, componentes)
components/               Shell (encabezado, campana, nav, idle logout), PhotoMark (editor de marcas), Photo (visor), BarcodeScan, OwnerPicker, Ring, Bi, Guide, Icons, Art, Brand, ThemeToggle
lib/                      db, api (route wrapper), session, roles, site, dates, schedule (generación de auditorías), issues, notify, push, pushClient, outbox, jobs, archive, reports, adminlog, client, zones, config, password, import, bi
scripts/setup.js          esquema + migraciones + seeds idempotentes
data/                     question-bank.json (24 plantillas/441 preguntas), question-i18n.json, qe-process.json (19 preguntas), qe-specific.json (21 preguntas fijas), roster.js (usuarios iniciales)
public/                   assets (ver §5), manifest.json, sw.js (service worker)
instrumentation*.js       arranque de tareas programadas
README.md                 notas por funcionalidad (complementario a este documento)
```

## 3. Reglas de negocio (consolidado de todo lo que pidió el usuario)

### 3.1 Roles y acceso
- `access`: `master` | `admin` | `lead` | `auditor`. Con una sola planta, `master` se presenta como “Administrador”. **Admin/máster NO auditan** (no se les programan auditorías). `lead` se comporta como `auditor`. Solo admin/máster ven Panel, Admin, Reportes, TV de otros, auditorías ajenas.
- **Capas (layer) 1–4.** Layer 1 (QE, PE, supervisores, OJT, mold tech, paint, logística/shippers, RH…) audita **en día(s) fijo(s)** con **zona/máquina**; Layer 2 (gerentes), 3 (GM), 4 hacen **una auditoría semanal “All Areas”** (fecha lunes, vence viernes) y **escogen el área al iniciar** (sin N/P ni zona asignada).
- Departamentos (`dept`): quality (Calidad), process (Procesos), production (Producción), logistics (Logística), hr (RH), maintenance, toolroom (Tool Room), program, management (Gerencia).
- **Cierre por inactividad:** 15 min para auditores/líderes, **45 min** admin/máster (cliente + latido `/api/auth/ping` + `last` en el JWT). “Recordarme” = sesión 14 días; si no, cookie de sesión y 12 h.
- Rutas protegidas con `route(handler,{need})` de `lib/api.js` (`admin`, `master`, o sesión). Verificación de planta con `siteScope()`/`sameSite()`.

### 3.2 Generación de auditorías (`lib/schedule.js → ensureWeek(monday)`)
- Se genera **por semana (lunes–viernes), de forma idempotente y memorizada 60 s** (`resetEnsured()` tras cambios). Índice único `(user_id, date, kind, slot)`.
- Layer 1: una auditoría por cada día en `users.days` (1=Lun…5=Vie). **El área rota semana a semana** por `users.pool` (`start_idx`, y `rotate_daily` para PE). Referencia: `settings.ref_monday = 2026-10-05`.
- Layer ≥ 2: una por semana “All Areas”.
- **Preguntas:** ventana deslizante de `templates.per_audit` (default 10) sobre las preguntas activas **no fijas** de la plantilla + **todas las preguntas `required` (fijas)**. La ventana avanza por semana/día/usuario para cubrir todo el banco.
- Respeta `settings.go_live` (global) y `sites.go_live`; nada antes de esas fechas (no aparece “No realizada”). `users.lpa_from` evita crear LPA de días pasados al encender la LPA de un usuario.
- **Ventana de registro:** solo el **mismo día programado** (semanales: lunes–viernes). Después = “No realizada” y el servidor rechaza el envío.
- **Admin puede mover una auditoría pendiente de día** (Asignaciones → 📅): mismo rango lun–vie de la semana, de hoy en adelante, no semanales; el día original se guarda en `audit_skips` y no se regenera.
- **LPA por usuario:** `users.lpa_override` (NULL = según rol; TRUE/FALSE = decisión del admin en su perfil, interruptor “Hace LPA”). Los QEs (Calidad, Layer 1) dependen además del interruptor general `settings.qe_lpa_on` (hoy apagado).

### 3.3 Auditoría de proceso de los QEs (piloto, solo MPQ)
- Tipo `kind='process'`, plantilla **“QE Process Audit”** (`data/qe-process.json`): **19 preguntas bilingües** (formato “QE Layer 1 Audit”); 17 llevan número de ítem (1033, 1341, 2290, 106, 1031, 100, 1032, 173, 2102, 1042, 453, 2304, 455, 458, 459, 448, 449) y 2 (Plan de Control) no tienen número. **Las 19 van en cada auditoría.**
- **2 diarias por QE** (`slot` 1 y 2 = “Proceso 1/2”, mañana/tarde), lunes a viernes; el admin cambia cuántas (0–5) en Admin → QEs (`settings.qe_process_per_day`, default 2).
- Solo les aparece a los QEs (no hay pestaña aparte): en **Hoy → Por realizar** y en **Mi semana**; orden: primero la 1 y luego la 2. Etiqueta de tipo en cada tarjeta (morada “Auditoría de proceso” / azul “LPA”).
- Al iniciar: elegir **zona → máquina → N/P** (ver §3.4). Se puede **corregir** zona/máquina/N-P después (queda marcado “✎ corregido” y se guarda el original en `part_original`/`area_original`).
- **Reporte** (`/audit/[id]/report`): media hoja, para descargar/imprimir (PDF). Saludo por hora (“Buen día / Buenas tardes / Buenas noches. Realicé una auditoría y estos son los resultados:”), título centrado “Reporte de auditoría de proceso”, score, meta con íconos (auditor, N/P, fecha, zona/máquina, resultado `15 OK · 0 X · 1 Δ · 3 N/A`). Sin hallazgos: solo “✓ No hay hallazgos”. Con hallazgos: tarjeta por hallazgo con ítem, hallazgo, acción correctiva y **foto** (clic = pantalla completa con botón regresar). **Δ en amarillo (“Se puede mejorar”), X en rojo.** Una página; solo pasa a una segunda si los hallazgos lo requieren; sin hoja en blanco al final (iOS).
- **Admin → QEs:** contador de auditorías de proceso por QE, KPIs filtrables, tabla por persona con cada día dividido **Mañana/Tarde** (✓ verde / ✗ rojo / gris pendiente); cada casilla abre su auditoría (si está hecha, con resultado; si no, “Aún no realizado”).
- **TV de QEs** (`/tv/qes?key=TV_KEY`): estatus de las auditorías de proceso.
- Los hallazgos de estas auditorías abren **Open Issues** igual que en las LPA.

### 3.4 Inicio de auditoría (“Antes de empezar”) — Layer 1 y QEs
- Pantalla con foto de encabezado (la del hero) y tarjetas de zona grandes: **A1, A2, B1, B2, C1, C2, C3, D1, D2, E2 (no E1), PL1, PL3, PL4**, cada una con color por familia (A azul, B verde, C naranja, D morado, E2 teal, PL gris) y botón ›. Letras de zona grandes; sin scroll.
- Después **máquina** (no aplica en PL1/PL3/PL4): botones sugeridos (`SEED_MACHINES` en `lib/zones.js`: A1-9, A2-3, A2-4, B1-1…B1-15, B2-1, B2-2, E2-6, más las capturadas antes) y texto libre “Otra máquina…”.
- Después **número(s) de parte** (tarjeta “cubo” + campo): segundo N/P opcional para piezas espejo RH/LH (“Segundo N/P (pieza espejo RH / LH)”; se guarda “A / B”). Botón **📷 Escanear** (código de barras/QR con cámara; BarcodeDetector nativo o ZXing en iPhone) o escribir a mano.
- La asignación semanal del admin (Layer 1, solo **zona**; el N/P lo captura el auditor) aparece como “Zona asignada por el administrador: ZONA D-E”.
- Layer 2/3/4: solo eligen el área (“All Areas”).

### 3.5 Runner de preguntas
- Una pregunta por pantalla: categoría + “Ítem N”, texto bilingüe (`Bi`: español arriba, inglés cursiva abajo, **texto justificado**), botones **OK / X / Δ / N/A**. X y Δ exigen **descripción** (≥3 caracteres) y **foto de evidencia obligatoria** (con editor de marcas), “Contención / acción inmediata”, responsables (OwnerPicker, varios) y la casilla **“✅ Se corrigió en el momento”** (pide acción + **foto de la corrección**; el issue nace cerrado).
- **Se puede saltar** una pregunta (“Saltar ›”); al terminar la etapa regresan las pendientes (“Siguiente pendiente ›”, “Faltan N preguntas por contestar”); no se puede avanzar de etapa/enviar hasta completarlas.
- **Editor de marcas de foto** (`PhotoMark`): círculo, flecha, trazo libre, 4 colores, **✥ Mover** (seleccionar con marco azul, arrastrar), **＋ Agrandar / － Achicar** (±20 %), **🗑 Borrar** la marca seleccionada, **Deshacer** la última.
- Número de **ítem** visible en cada pregunta (según el formato cargado). Borrador local en `localStorage` (`lpa-draft-<id>`), incluida etapa, partes y shipper.
- **Sin señal:** si el envío falla por red, queda en `lpa-outbox` (localStorage) y se envía solo al volver la conexión (banner “Sin señal…”, “N auditorías pendientes de enviar”, reintentar/descartar). Zona/máquina/N-P deben capturarse con señal.
- Duración: se mide “tiempo activo” (pantalla visible y actividad ≤60 s); auditorías LPA **<10 min** generan aviso al admin (campana). Las de proceso están excluidas de esa regla. (La pestaña “Tiempos” fue eliminada.)
- Score = OK / (OK + X + Δ). Cada X/Δ abre un hallazgo con compromiso a **7 días**.

### 3.6 LPA de los QEs: etapas adicionales (apagada hoy; se enciende por usuario o en Admin → QEs)
Plantilla **“Quality Engineer”** (44 preguntas propias que rotan, 10 por auditoría) **+ 21 preguntas fijas** (`data/qe-specific.json`, `questions.required=true`, sin número de ítem). Cada LPA de QE tiene 31 preguntas, en **tres etapas separadas** (nunca mezcladas):
1. **Auditoría en piso** (las 10 que rotan).
2. **Auditoría gerencial** (formatos QA-062-C / QA-075-C), 12 preguntas. Pantalla de inicio de etapa: **“El producto en la auditoría gerencial”** → partes revisadas (nombre*, número*, color, frecuencia/shipper; varias partes, se guardan en `audits.extra.parts`). Cada hallazgo exige **parte** (si hay más de una), **sticker** (Blanco/Verde/Amarillo/Naranja/Rosa), **número de operador** y **turno** (1er/2do/3er), que también se anexan a la descripción del issue.
3. **Dock Audit** (formato QA-076-C), 9 preguntas. Pantalla de inicio: **Shipper #** obligatorio (`audits.shipper`). **Plan de reacción:** todo hallazgo se asigna automáticamente a los **Gerentes de Logística** (layer ≥ 2, dept logistics) de la planta.
- Chip “Etapa N de M · …”, contador y barra por etapa, botón “Terminar etapa ›”, y un **resumen único** al final.
- En Admin → Preguntas cualquier pregunta se puede **fijar (📌)** o quitar de las fijas.

### 3.7 Open Issues (hallazgos)
- Cada X/Δ abre un issue `OI-0001…`, con compromiso a 7 días, responsables (varios) y bitácora. Estados por color: **Abierto verde, Por vencer (≤2 días) amarillo, Vencido rojo, Cerrado verde**. Tarjeta: símbolo X/Δ, número OI, chip “Ítem N”, pregunta justificada, campos **Zona/Máquina · N/P · Fecha · Auditor**, chips con el **nombre de cada responsable** (✓ si terminó) y compromiso.
- Seguimiento del responsable: acción + **foto de evidencia de cierre** (obligatoria para “Terminé mi parte”). Cerrar el issue (líder o **el mismo auditor**) exige acción + evidencia. “Cerrar como líder” es una sección propia (texto + foto + botón “Cerrar issue”); Compromiso va en un campo aparte; Reabrir/Eliminar en su renglón.
- **Admin puede eliminar** un hallazgo (razón obligatoria ≥5 caracteres, queda en `finding_deletions`) y **eliminar una auditoría realizada** para que se vuelva a hacer (razón obligatoria, `audit_deletions`; borra respuestas/hallazgos y la auditoría se regenera pendiente).
- Pestañas: A mi cargo / Abiertos / Sin responsable (admin) / Cerrados. Hallazgo repetido (mismo ítem ≥2 veces en la misma zona en 30 días) avisa al admin.

### 3.8 Avisos, recordatorios, escalamiento (lib/jobs.js, lib/notify.js, lib/push.js)
- **Campana** para todos (tabla `notifications`, `dedupe` evita repetir): se te asignó un issue, issue por vencer/vencido (diario por responsable), recordatorios de auditoría pendiente (12:30 y 16:00), resumen del día al admin (17:30), reporte semanal listo (viernes 16:00), hallazgo repetido, avisos de archivo, auditoría LPA muy corta.
- **Escalamiento:** issue con 3 y 7 días de retraso → admins + gerentes (Layer 2+) del departamento.
- **Push (Web Push):** botón en la campana; llaves VAPID autogeneradas; en iPhone requiere instalar la PWA.
- **Archivo de fotos antiguas** (Admin → Registro): cada madrugada (2–5 am) elimina fotos de auditorías/issues con más de 365 días (configurable, 0 = nunca) y avisos >90 días; **aviso al admin una semana antes** y al terminar; botón “Archivar ahora”.

### 3.9 Administración
- **Asignaciones** (Layer 1): tabla Persona (avatar + depto) × Lun–Vie; cada día es un **botón de color por familia de zona** (A azul, B verde, C naranja, D morado, E2 teal, PL gris, sin asignar punteado) que abre un selector **solo de zona** (Zona completa A–E arriba y zonas específicas A1…PL4 abajo; la máquina NO se asigna, la elige el auditor; también 📅 cambiar de día y quitar asignación); el valor se guarda como `B2` o `ZONA C`; chip “N de N asignadas”, leyenda de colores y barra “Guardar cambios”; “Pegar desde Excel” (tabla completa Nombre+Lun..Vie o filas Nombre,Día,Zona), **descargar plantilla .csv / cargar archivo .csv**; botón 📅 para cambiar de día; guarda en lote.
- **Usuarios y rotación:** agrupados por **Layer** (desplegables; Layer 1 abierto) y dentro por **departamento** (cerrados por defecto), tarjetas compactas con avatar de color por departamento; interruptor **Hace LPA**; importar usuarios; contraseña; días; pool de áreas.
- **Preguntas** (solo máster / admin en una planta): por plantilla, bilingüe, activar/desactivar, **fijar**, editar, eliminar, **Historial de versiones**.
- **QEs, Reportes (↗ /reports), Registro** (bitácora automática de cambios del admin + eliminaciones con su razón + archivo de fotos), **Plantas** (solo multi-planta).
- **Panel** (`/dashboard`): cumplimiento por capa/depto/semana, áreas con menor score, preguntas que más fallan, faltantes, gráfica de pastel de resultados, “progreso del día” (se quitaron “acciones rápidas” y “auditorías gerenciales”); enlace a LPA TV.
- **Reportes** (`/reports`): pareto de hallazgos (ítem/zona/máquina/N-P) con % acumulado, repetidos, cumplimiento por persona, **descargas CSV** (cumplimiento, issues, auditorías, asignación semanal; UTF-8 con BOM para Excel), **respaldo JSON** completo (con/sin fotos, sin contraseñas), **reporte semanal** imprimible (`/reports/weekly`).
- **Versiones de preguntas:** cada edición guarda la anterior (`question_versions`); las respuestas conservan texto e ítem del momento (`responses.question`, `responses.item_no`).

### 3.10 TV
- `/tv?key=TV_KEY` (LPA general; sin login; refresca cada minuto, rota páginas cada 10 s; modo oscuro por defecto) y `/tv/qes?key=…`.

## 4. Pantallas (qué se ve y cómo)

- **Login:** sin scroll en móvil, imagen de fondo `login-bg.webp` + “pellets”, campos con íconos (`#u`, `#p`), botón `button.go`, selector ES/EN y toggle de tema.
- **Encabezado (todas las pantallas):** hero con foto de Querétaro (`app-hero.webp`), logo Mitchell, “LPApp” (LP blanco, App naranja), nombre y “Calidad · Layer 1”; botones circulares: campana, luna/sol (tema), “?” (guía), iniciales, salir. **Tab bar flotante** inferior: Hoy, Semana, Issues (+Panel y Admin para admin); píldora azul en la pestaña activa.
- **Hoy:** secciones **Por realizar / Próximas / Completadas hoy / Completadas esta semana** (lo completado hoy aparece en ambas); “En proceso/Continuar” si ya se inició. Sin scroll innecesario; el dashboard del admin muestra el panel (anillo de progreso, etc.).
- **Mi semana:** tarjetas por auditoría con día, zona/máquina, N/P (chip naranja), estado (Completada 94 % verde / Programada dorado / Último día / No realizada rojo / Próxima gris) y etiqueta de tipo.
- **Audit (detalle):** encabezado “Auditoría realizada” + línea “Zona A1 / Máquina A1-9”, chip N/P, meta (plantilla, auditor, layer, depto, shipper), botón azul “Descargar reporte” (proceso), tarjeta de score con anillo, respuestas; para el admin: **🗑 Eliminar para que se vuelva a hacer**. Si no es del usuario y está pendiente: tarjeta “Aún no realizado”.
- **Texto justificado** en preguntas/hallazgos de issues y reportes.
- **Modo claro por defecto**; oscuro solo si el usuario lo elige (`localStorage.lpa-theme`); TV en oscuro por defecto.

## 5. Diseño visual y assets (para que quede igual)

- **Tokens** (`:root` en `app/globals.css`): fondo `#f1f4f9`, panel `#fff`, tinta `#0b1f4d`, texto `#15202f`, sub `#61708a`, marca `#0b3a8c → #2272ea`, accent `#2272ea`, teal `#2c8c97`, naranja `#e36a0a`, ok `#2b8a69`, nok `#c0453d`, parcial `#b87814`, radios 20/14/999, sombras suaves. Tema oscuro con `:root[data-theme="dark"]`.
- **Fuentes:** Plus Jakarta Sans (400–800) y JetBrains Mono (para códigos OI y N/P), Google Fonts.
- **Colores por departamento** (avatares/tarjetas): calidad azul, procesos morado, producción naranja, logística teal, RH rosa, etc. (`--d-*` en el CSS).
- **Assets en `public/`** (incluidos en el zip, NO regenerar): `app-hero.webp` (foto panorámica de Querétaro al atardecer con acueducto, encabezado de toda la app), `login-bg.webp`, `login-pellets.webp`, `mitchell-logo.png` / `mitchell-logo-light.png` (logo naranja “mp mitchell PLASTICS” para fondo claro/oscuro), `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `manifest.json`, `sw.js`. Las fotos de zonas (“tarjetas de zona”) usan gradientes/imagen de planta definidos en el CSS (`.ztile…`).
- **Imágenes de referencia de la interfaz** (capturas del usuario, ~90): carpeta `reference-screenshots/` ordenada cronológicamente (ver su `INDEX.md`). Contienen: capturas de iPhone de cada pantalla durante la construcción, el Excel/foto del **programa semanal**, el formato de **auditoría de proceso de QE** (19 preguntas con ítems), las fotos de formatos **QA-062-C, QA-075-C, QA-076-C**, el diseño de referencia de tarjetas de zona, tablas de admin, reportes impresos, y una grabación de pantalla (`ScreenRecording…`) del problema de lentitud de carga.

## 6. Modelo de datos (resumen; ver `scripts/setup.js`)

`sites` · `users` (access, dept, layer, template_id, days[], pool[], start_idx, rotate_daily, active, site_id, lpa_override, lpa_from, must_change, onboarded) · `templates` (name, zone, per_audit) · `questions` (text bilingüe “es\nen”, category, sort_order, active, item_no [-1 = sin número], required, version) · `question_versions` · `audits` (user_id, date, due_date, kind lpa|process, slot, area, zone, machine, part_number, part_original, area_original, part_edited_at, template_id, question_ids[], status, score/ok/nok/partial/na counts, started_at, active_sec, late, shipper, extra{parts}) · `responses` (question snapshot, item_no, result, notes, corrective, evidence base64, extra{sticker,operator,shift,part}) · `findings` (+ `finding_owners`, `finding_updates`, `finding_evidence`) · `notifications` (link, dedupe único) · `push_subs` · `settings` (go_live, ref_monday, qe_process_per_day, qe_lpa_on, archive_photos_days, archive_last, vapid_*, banderas de migración `qe_*_v1`, `pilot_start_v1`) · `admin_log` · `audit_deletions` · `finding_deletions` · `audit_skips`.
Las fotos se guardan como data-URL base64 en la BD (comprimidas ≤1280 px JPEG).

## 7. API (generada del código)

| Ruta | Métodos | Permiso |
|---|---|---|
| `/api/admin/archive` | GET, PUT | master |
| `/api/admin/assignments` | GET, PUT | admin |
| `/api/admin/audits/[id]/reset` | POST | admin |
| `/api/admin/backup` | GET | master |
| `/api/admin/export` | GET | admin |
| `/api/admin/log` | GET | admin |
| `/api/admin/notifications` | GET, POST | admin |
| `/api/admin/qes` | GET, PUT | admin |
| `/api/admin/questions/[id]/history` | GET | master |
| `/api/admin/questions/[id]` | PATCH, DELETE | master |
| `/api/admin/reports/compliance` | GET | admin |
| `/api/admin/reports/pareto` | GET | admin |
| `/api/admin/reports/repeats` | GET | admin |
| `/api/admin/reports/weekly` | GET | sesión |
| `/api/admin/sites/[id]/import` | POST | admin |
| `/api/admin/sites/[id]` | PATCH | master |
| `/api/admin/sites` | GET | admin |
| `/api/admin/stats` | GET | admin |
| `/api/admin/templates/[id]/questions` | GET, POST | master |
| `/api/admin/templates/[id]` | PATCH | master |
| `/api/admin/templates` | GET | admin |
| `/api/admin/users/[id]` | PATCH | admin |
| `/api/admin/users` | GET, POST | admin |
| `/api/audits/[id]/part` | POST | sesión |
| `/api/audits/[id]` | GET, PATCH | admin |
| `/api/audits/[id]/setup` | POST | sesión |
| `/api/audits/[id]/start` | POST | sesión |
| `/api/audits/[id]/submit` | POST | sesión |
| `/api/auth/login` | POST | sesión (público/clave)|
| `/api/auth/logout` | POST | sesión |
| `/api/auth/me` | GET | sesión |
| `/api/auth/onboarded` | POST | sesión |
| `/api/auth/pin` | POST | sesión |
| `/api/auth/ping` | POST | sesión |
| `/api/dashboard` | GET | lead |
| `/api/evidence/[id]` | GET | sesión |
| `/api/findings/[id]/evidence/[eid]` | GET | sesión |
| `/api/findings/[id]` | GET, PATCH, DELETE | admin |
| `/api/findings/count` | GET | sesión |
| `/api/findings` | GET | sesión |
| `/api/my` | GET | sesión |
| `/api/notifications` | GET, POST | sesión |
| `/api/push/key` | GET | sesión |
| `/api/push/subscribe` | POST, DELETE | sesión |
| `/api/qes` | GET | sesión |
| `/api/sites` | GET | sesión |
| `/api/tv/qes` | GET | sesión (público/clave)|
| `/api/tv` | GET | sesión (público/clave)|
| `/api/users` | GET | sesión |
| `/api/week` | GET | sesión |

Todas las rutas de escritura de admin se registran automáticamente en `admin_log` (desde `route()` en `lib/api.js`).

## 8. PWA, offline y rendimiento
- `public/manifest.json` + `public/sw.js`: cachea estáticos y lo ya visitado; push (`push`, `notificationclick`); se limpia al cerrar sesión (`clearOfflineCache`).
- Rendimiento: imágenes WebP con cabeceras de caché de 1 semana, `peek()`/`api()` guardan GET en `sessionStorage` para pintar al instante, `ensureWeek` memorizado, consultas agregadas, hero con `fetchPriority="high"`.

## 9. Decisiones y cosas que NO hay que “arreglar”
- El `E1` no existe: es **E2**. Las zonas PL, Toolroom, Shipping y Receiving no tienen máquina.
- Layer 3/4 y Layer 2 **no** llevan N/P ni zona asignada.
- El auditor no cambia la asignación del admin; sí puede **corregir** zona/máquina/N-P de su auditoría ya hecha (queda marcado).
- QEs hoy: **solo auditorías de proceso**; su LPA se enciende por usuario (“Hace LPA”) o en bloque.
- “Tiempos” (estadísticas de duración) se eliminó de Admin a petición del usuario (el cálculo sigue en el servidor).
- La aplicación es **modo claro** salvo elección del usuario.
- Evidencia fotográfica obligatoria en todo hallazgo y en todo cierre.

## 10. Pendientes / ideas no construidas
- Excel real `.xlsx` con formato (hoy `.csv`).
- Captura de zona/máquina/N-P sin señal.
- Metas y semáforo de cumplimiento por rol; mover turno de una auditoría de proceso o reasignarla a otro QE desde Admin → QEs.
- Tabla completa de “partes auditadas” del QA-062-C más allá de nombre/número/color/frecuencia.
- Segundo factor para admin y límite de intentos de login; regenerar la guía de uso/PDF con las funciones nuevas.
- Probar en planta: push en iPhone, escáner con etiquetas reales y envío sin señal.

## 11. Prompt sugerido para la IA de la empresa
> “Eres el equipo de ingeniería de LPApp. Lee `HANDOFF.md` completo y luego el código. No cambies reglas de negocio ni diseño sin pedir confirmación. Para reproducir la UI, usa las capturas de `reference-screenshots/` y los assets de `public/`. Corre `npm install`, define las variables de entorno de §1, apunta `DATABASE_URL` a un Postgres vacío y ejecuta `npm run build && npm start` (el esquema se crea solo). Entra con `admin` / `ADMIN_PASSWORD`.”

## Anexo: auditorías de proceso tardías
Las auditorías de proceso (QEs) **sí se pueden hacer después de su día programado**: la pantalla ofrece “Realizar de forma tardía”, el servidor las acepta y se guardan con `late=true`. En el resultado sale la etiqueta “⏰ Realizada tarde · programada …” y el **reporte** lleva una franja amarilla con la fecha programada y la fecha real. Las LPA normales siguen sin poder registrarse fuera de su día.

## Anexo: navegación con “atrás”
Las pestañas y filtros viven en la URL (`useUrlState` / `useWeekUrl` en `lib/client.js`): Admin (`?tab=`), Issues (`?v=`), Panel (`?w=`), Reportes (`?d=&by=`), Semana (`?dept=&layer=&wk=`), QEs (`?f=&wk=`) y la semana de Asignaciones (`?wk=`). Cada cambio añade una entrada al historial, así el botón/gesto de regresar vuelve a la pestaña o semana anterior; recargar conserva la vista.

## Anexo: cambios recientes (16 oct 2026)
- **Asignaciones (admin):** tabla persona × día con botones de color por zona; al tocar uno se elige *Zona* (A, B, C, D, E completa, o una zona específica como A1…E2, PL1, PL3, PL4, Toolroom, Shipping, Receiving) y la **máquina la captura el auditor** al auditar. Los días no disponibles se ven tachados con el motivo; “Guardar cambios” va en barra fija arriba/abajo. Cambiar el día de una auditoría pendiente no regenera el día original (`audit_skips`).
- **Zonas sin máquina:** PL1, PL3, PL4, Toolroom, Shipping, Receiving (`lib/zones.js`, `NO_MACHINE`); orden A, B, C, D, E, PL1, PL3, PL4… (`zoneRank`).
- **Resumen de hoy (admin):** pendientes y completadas ordenadas por zona; cada persona con departamento y tipo (LPA / Proceso).
- **Corrección 20/19:** el índice de pregunta ya no se sale de rango al terminar las saltadas.
- **QEs (admin):** casilla de auditoría hecha **tarde en morado** (verde = a tiempo, rojo = no realizada, gris = pendiente).
- **Reporte (`/audit/[id]/report`):** la foto de cada hallazgo (con marcas) va **en grande debajo del texto**, ancho completo (en PDF con tope de altura), ya no como miniatura a la derecha.
- **TV (`/tv`, ≥1200 px = una pantalla sin scroll):** encabezado con logos a la izquierda, título centrado en la hoja, chips y reloj a la derecha; KPI “Cumplimiento diario” (hoy vs. día hábil anterior), “No realizadas esta semana” grande y cumplimiento por capa compacto; pendiente = amarillo, realizada = verde, rojo solo para no realizadas; “Le toca hoy” ordenado por zona.
- **Navegación:** pestañas/filtros/semana en la URL (botón atrás regresa a la vista previa).
- **Nota de captura:** en capturas completas de iPhone el menú inferior (fixed) aparece a media página; es artefacto de la captura, no un fallo.
- Los tableros QIA/Safe Launch (foto de “Días sin defectos”) **no son parte de LPApp**.
