// Interruptor de varias plantas. Apagado (por defecto): LPApp opera solo con MPQ y se oculta todo lo de plantas.
// Para expandirte después: MULTI_SITE=true en las variables del servicio.
export const MULTI_SITE = process.env.MULTI_SITE === 'true';
export const HOME_SITE = process.env.HOME_SITE || 'MPQ';
