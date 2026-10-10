// Reglas de contraseña: mínimo 8 caracteres (letras, números o símbolos).
export const MIN_PASSWORD = 8;
export const passwordError = (p) =>
  String(p || '').length >= MIN_PASSWORD && String(p).length <= 72 ? null : `La contraseña debe tener de ${MIN_PASSWORD} a 72 caracteres`;
