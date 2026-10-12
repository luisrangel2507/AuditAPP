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
- **Roles de acceso:** `auditor` (hace sus LPAs), `lead` (panel, reasignar, asignar responsables), `admin` (usuarios y preguntas).
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
| `ADMIN_PASSWORD` | contraseña del usuario `admin` (mín. 8 caracteres); se crea en el primer arranque |
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

## Plantas (MPQ, MPS, MPC, UMW, MPD)
Una sola app para todas las plantas. Cada usuario pertenece a una planta y solo ve la suya (auditorías, issues, panel, TV, usuarios);
el **admin** no tiene planta y cambia de vista con el selector del encabezado ("Todas las plantas" o una en particular).
Lo que ya existía queda como **MPQ**. Las demás nacen sin activar: no generan auditorías ni cuentan en el cumplimiento hasta ponerlas en marcha.

**Onboarding de una planta** (Admin → Plantas):
1. **Importar usuarios**: pega desde Excel una fila por persona (`Nombre, Depto, Capa, Plantilla, Días, Áreas, Acceso`; varias áreas con `|`).
   "Revisar" valida todo antes de crear nada. Sin contraseña inicial, cada persona recibe una aleatoria distinta que se muestra **una sola vez** (botón "Copiar").
2. Entregar las contraseñas; cada quien la cambia en su primer ingreso.
3. **Poner en marcha** con la fecha de arranque (desde ese día se generan las auditorías de la planta).
La pantalla TV de cada planta: `/tv?key=TV_KEY&site=MPQ` (o `/tv?site=MPQ` con sesión de líder).

## Guía de uso
La primera vez que alguien entra (ya con su contraseña propia) ve una guía corta según su rol; se puede reabrir con el botón **?** del encabezado.

## Asignaciones (zona y número de parte)
El auditor **no elige nada**: solo ve lo que le asignaron. En **Admin → Asignaciones** el admin carga, por persona y por día de la semana,
la **zona** a inspeccionar y el **número de parte** (la zona viene sugerida por la rotación y se puede cambiar; "Igual toda la semana" copia el primer día
a los demás). Solo el admin puede cambiar zona, número de parte o auditor de una auditoría pendiente; los líderes ya no pueden reasignar.
Para cargar muchos de una vez: **Pegar desde Excel** (columnas `Nombre, Día, Zona, No. de parte`; sin día = todos los días de la semana). Revisa los avisos por fila y los cambios quedan en la tabla hasta que pulses Guardar.
El número de parte se muestra en Hoy, en la auditoría, en Semana, en Issues y en la pantalla TV.

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
