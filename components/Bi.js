'use client';
import { splitBi } from '@/lib/bi';

// Pregunta en español (arriba) e inglés (abajo, más tenue). Si solo hay un idioma, muestra uno.
export default function Bi({ text }) {
  const { es, en } = splitBi(text);
  return <>{es}{en && <span className="bi-en">{en}</span>}</>;
}
