import { NextResponse } from 'next/server';
import { getUser } from './session';

export const json = (data, status = 200) => NextResponse.json(data, { status });
export const err = (message, status = 400) => NextResponse.json({ error: message }, { status });

// Envuelve un handler: exige sesión (y opcionalmente nivel de acceso) y captura errores.
export function route(handler, { need = 'auditor' } = {}) {
  return async (req, ctx) => {
    try {
      const user = await getUser();
      if (!user) return err('No autenticado', 401);
      if (need === 'lead' && !['lead', 'admin'].includes(user.access)) return err('Sin permiso', 403);
      if (need === 'admin' && user.access !== 'admin') return err('Solo administradores', 403);
      return await handler(req, ctx, user);
    } catch (e) {
      console.error(req.method, req.url, e);
      return err('Error interno', 500);
    }
  };
}
export const isLead = (u) => ['lead', 'admin'].includes(u.access);
