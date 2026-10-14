'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Foto que al tocarla se abre en pantalla completa, con botón para regresar
export default function Photo({ src, alt = 'foto del hallazgo', className = '', style, eager = false }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      <img className={className} style={{ cursor: 'zoom-in', ...style }} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} />
      {open && createPortal(
        <div className="photo-full" role="dialog" aria-label="Foto en pantalla completa" onClick={() => setOpen(false)}>
          <button type="button" className="photo-back" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>← Regresar</button>
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>, document.body)}
    </>
  );
}
