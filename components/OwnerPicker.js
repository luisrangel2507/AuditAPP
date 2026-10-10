'use client';
import { useEffect, useState } from 'react';
import { api, DEPT } from '@/lib/client';

let cache = null;
export function useUsers() {
  const [users, setUsers] = useState(cache || []);
  useEffect(() => { if (!cache) api('/api/users').then((u) => { cache = u; setUsers(u); }).catch(() => {}); }, []);
  return users;
}

// Chips de responsables + selector para agregar más. `value` = ids; `locked` = ids que no se pueden quitar aquí.
export default function OwnerPicker({ value, onChange, locked = [], exclude = [], label = 'Responsables de seguimiento' }) {
  const users = useUsers();
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return (
    <div>
      {label && <label className="lbl">{label}</label>}
      <div className="row wrap" style={{ gap: 6, marginBottom: value.length ? 8 : 0 }}>
        {value.map((id) => (
          <span key={id} className="chip open">{byId[id]?.name || `#${id}`}
            {!locked.includes(id) && <button type="button" className="chip-x" aria-label="Quitar" onClick={() => onChange(value.filter((x) => x !== id))}>✕</button>}
          </span>))}
      </div>
      <select className="inp" value="" onChange={(e) => { const id = Number(e.target.value); if (id && !value.includes(id)) onChange([...value, id]); }}>
        <option value="">+ Agregar responsable…</option>
        {users.filter((u) => !value.includes(u.id) && !exclude.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name} · {DEPT[u.dept]}</option>)}
      </select>
    </div>
  );
}
