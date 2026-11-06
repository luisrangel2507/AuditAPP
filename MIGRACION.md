# LPApp · Guía de migración

## Qué se migra
1. **Código**: esta carpeta (Next.js 15 + PostgreSQL). En el paquete ZIP está en `codigo/`.
2. **Datos con fotos**: `datos/lpapp_respaldo_con_fotos.json` (todas las tablas, sin contraseñas). Las fotos también vienen sueltas en `fotos/` con su `indice.csv`.
3. **Imágenes de la app**: `public/` (logos, fondos, iconos, layout de planta).
4. **Capturas de pantallas**: `docs/pantallas/` como referencia visual de cada pantalla.

## Requisitos del servidor
- Node.js 18.17 o mayor (recomendado 20).
- PostgreSQL 14 o mayor.
- HTTPS con dominio de la empresa (obligatorio para instalar en celular, cámara y avisos push).

## Variables de entorno
| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (obligatoria) |
| `SESSION_SECRET` | Firma de sesiones, texto largo aleatorio (obligatoria) |
| `ADMIN_PASSWORD` | Contraseña inicial del usuario `admin` (obligatoria) |
| `TV_KEY` | Llave de las pantallas TV sin login |
| `HOME_SITE`, `MULTI_SITE`, `LPA_GO_LIVE` | Planta principal, varias plantas, fecha de arranque |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `ALERT_EMAILS` | Correo (opcional) |
| `VAPID_SUBJECT` | Avisos push (las llaves se generan solas en la base) |
| `SEED_PASSWORD` | Contraseña para usuarios que se crean automáticamente (opcional) |

## Arranque
```
npm ci
npm run build
npm start        # corre scripts/setup.js (crea/actualiza tablas, idempotente) y levanta la app
```

## Datos
- Opción A (misma app, otro servidor): copiar la base con `pg_dump` / `pg_restore`.
- Opción B (otro sistema): importar `datos/lpapp_respaldo_con_fotos.json`. Cada tabla es una lista de registros; las fotos están como `data:image/...;base64` en `responses.evidence` y `finding_evidence.data`. `counts` indica cuántos registros debe haber por tabla.
- Las contraseñas no se exportan: hay que asignarlas de nuevo. Los avisos push se reactivan en cada teléfono.
