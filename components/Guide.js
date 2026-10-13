'use client';
import { useState } from 'react';
import { I } from '@/components/Icons';
import { isAdmin, isMaster } from '@/lib/roles';

// Guía de uso (onboarding interno): pasos cortos según el rol de quien entra.
function stepsFor(user) {
  const admin = isAdmin(user), master = isMaster(user), mgr = user.layer >= 2;
  const out = [
    { icon: I.home, title: `Bienvenido a LPApp${user.site_code ? ' · ' + user.site_code : ''}`,
      text: 'Aquí haces tus auditorías por capas (LPA) desde el teléfono o la computadora y das seguimiento a los hallazgos. Esta guía toma un minuto.' },
    mgr
      ? { icon: I.calendar, title: 'Tu auditoría semanal', text: 'Tienes una auditoría por semana en "All Areas". Puedes hacerla de lunes a viernes; vence el viernes. Si pasa la semana, queda como No realizada.' }
      : { icon: I.calendar, title: 'Tu auditoría de hoy', text: 'En Hoy ves la auditoría que te toca. Solo se puede registrar el mismo día programado: si pasa el día, queda como No realizada. El área rota cada semana; el día es siempre el mismo.' },
    { icon: I.play, title: 'Cómo responder', text: 'Cada pregunta se contesta con ✓ OK, ✕ No cumple, Δ Parcial o N/A. Si marcas ✕ o Δ debes escribir un comentario, y puedes agregar foto, una acción inmediata y los responsables. Si pierdes señal, tus respuestas se guardan en el teléfono.' },
    { icon: I.chart, title: 'Issues (hallazgos)', text: 'Cada ✕ o Δ abre un issue con 7 días para cerrarlo. Cada responsable da seguimiento a su parte y el issue se cierra solo cuando todos terminan. La insignia en Issues te muestra lo que tienes a cargo.' },
  ];
  if (admin) out.push({ icon: I.grid, title: 'Semana y Panel', text: 'Semana es el programa de toda la planta. Panel muestra cumplimiento por capa y departamento, la gráfica de resultados, los open issues en PDCA, áreas con menor score, preguntas que más fallan y quién no hizo su auditoría. Desde Panel abres la pantalla TV de planta.' });
  else out.push({ icon: I.calendar, title: 'Mi semana', text: 'En Semana ves tus propias auditorías de la semana: qué día te toca, tu zona y tu número de parte. Solo ves tu información; el administrador es quien asigna y consulta el resto.' });
  if (master) out.push({ icon: I.settings, title: 'Rol máster', text: 'Eres el máster: ves todas las plantas con el selector del encabezado y eres quien las activa y las pausa en Admin → Plantas. También das de alta a los administradores de cada planta y administras el banco de preguntas, que es el mismo para todas.' });
  else if (admin) out.push({ icon: I.settings, title: 'Administración de tu planta', text: 'Eres el administrador de tu planta: en Admin gestionas usuarios y roles, cargas las contraseñas, importas usuarios y asignas la zona y el número de parte de cada día. Solo ves tu planta; el máster es quien la pone en marcha.' });
  out.push({ icon: I.lock, title: 'Tu contraseña es personal', text: 'No la compartas: todo lo que registres queda a tu nombre. Para dudas, habla con tu líder o con Calidad. Puedes volver a abrir esta guía con el botón ? del encabezado.' });
  return out;
}

export default function Guide({ user, onClose }) {
  const steps = stepsFor(user);
  const [i, setI] = useState(0);
  const s = steps[i], last = i === steps.length - 1;
  return (
    <div className="sheet-bg guide-bg" onClick={onClose}>
      <div className="guide" role="dialog" aria-label="Guía de uso" onClick={(e) => e.stopPropagation()}>
        <button className="guide-skip" onClick={onClose}>{last ? 'Cerrar' : 'Saltar'}</button>
        <div className="guide-ic">{s.icon(30)}</div>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        <div className="guide-dots">{steps.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <div className="row">
          <button className="btn alt grow" disabled={i === 0} onClick={() => setI(i - 1)}>Atrás</button>
          <button className="btn grow" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Empezar' : 'Siguiente'}</button>
        </div>
      </div>
    </div>
  );
}
