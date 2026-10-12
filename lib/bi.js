// Preguntas bilingües: se guardan como "español\ninglés" en un solo texto.
export const joinBi = (es, en) => {
  const a = String(es || '').trim(), b = String(en || '').trim();
  return a && b && a !== b ? `${a}\n${b}` : a || b;
};
export const splitBi = (t) => {
  const [es = '', ...rest] = String(t || '').split('\n');
  return { es: es.trim(), en: rest.join(' ').trim() };
};
