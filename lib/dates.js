// Todas las fechas son strings 'YYYY-MM-DD' en hora de la planta (America/Mexico_City).
const TZ = 'America/Mexico_City';

export function mxToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}
const toUTC = (s) => new Date(s + 'T12:00:00Z');
const fmt = (d) => d.toISOString().slice(0, 10);

// Turno según la hora de México: 1 = 22:00–06:00, 2 = 06:00–14:00, 3 = 14:00–22:00
export function shiftOf(d = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', hour12: false }).format(d)) % 24;
  return h >= 22 || h < 6 ? 1 : h < 14 ? 2 : 3;
}

export function addDays(s, n) {
  const d = toUTC(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}
// 1=Lun … 7=Dom
export function isoWeekday(s) {
  const w = toUTC(s).getUTCDay();
  return w === 0 ? 7 : w;
}
export function mondayOf(s) {
  return addDays(s, 1 - isoWeekday(s));
}
export function weeksBetween(aMonday, bMonday) {
  return Math.round((toUTC(bMonday) - toUTC(aMonday)) / (7 * 86400000));
}
export const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Ventana de ejecución: SOLO el día programado.
// Layer 1: un día. Layer 2/3 (auditoría semanal): de lunes a viernes (date..due_date).
export const closesOn = (a) => a.due_date;
export function windowState(a, today) {
  if (a.status === 'completed') return 'completed';
  if (today < a.date) return 'upcoming';
  if (today > a.due_date) return 'missed';
  return today === a.due_date && a.date !== a.due_date ? 'last_day' : 'open';
}
