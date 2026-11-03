'use client';
// Barra de herramientas de administración: la comparten Admin y Reportes para que se sientan una sola herramienta
export default function AdminTabs({ active, onSelect, me, master }) {
  return (
    <div className="seg uline" style={{ margin: '12px 0' }}>
      <button className={active === 'assign' ? 'on' : ''} onClick={() => onSelect('assign')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>Asignaciones</button>
      <button className={active === 'users' ? 'on' : ''} onClick={() => onSelect('users')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 5.2a3.4 3.4 0 0 1 0 6.6M18 14.8c1.9.7 3.2 2.4 3.5 5.2" /></svg>Usuarios y rotación</button>
      {(master || !me.multi_site) && <button className={active === 'q' ? 'on' : ''} onClick={() => onSelect('q')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.7.4-1.1.9-1.1 1.7M12 17v.1" /></svg>Preguntas</button>}
      <button className={active === 'abs' ? 'on' : ''} onClick={() => onSelect('abs')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" /></svg>Ausencias</button>
      <button className={active === 'qes' ? 'on' : ''} onClick={() => onSelect('qes')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg>QEs</button>
      <button className={active === 'reports' ? 'on' : ''} onClick={() => onSelect('reports')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3.5h7.5L19 8v12.5H7z" /><path d="M14 3.5V8h5M10 12.5h6M10 16h6" /></svg>Reportes</button>
      <button className={active === 'log' ? 'on' : ''} onClick={() => onSelect('log')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4.5" y="4" width="15" height="16.5" rx="2.5" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>Registro</button>
      {me.multi_site && <button className={active === 'sites' ? 'on' : ''} onClick={() => onSelect('sites')}>{master ? 'Plantas' : 'Mi planta'}</button>}
    </div>
  );
}
