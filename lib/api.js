import { NextResponse } from 'next/server';
import { getUser } from './session';
import { isAdmin, isMaster } from './roles';

export const json = (data, status = 200) => NextResponse.json(data, { status });
export const err = (message, status = 400) => NextResponse.json({ error: message }, { status });

// Envuelve un handler: exige sesión (y opcionalmente nivel de acceso) y captura errores.
export function route(handler, { need = 'auditor' } = {}) {
  return async (req, ctx) => {
    try {
      const user = await getUser();
      if (!user) return err('No autenticado', 401);
      if (need === 'lead' && !isAdmin(user)) return err('Sin permiso', 403); // solo admin/máster ven información de otros
      if (need === 'admin' && !isAdmin(user)) return err('Solo administradores', 403);
      if (need === 'master' && !isMaster(user)) return err('Solo el máster', 403);
      return await handler(req, { ...ctx, params: await ctx?.params }, user);
    } catch (e) {
      console.error(req.method, req.url, e);
      return err('Error interno', 500);
    }
  };
}
// Quien no es admin solo ve lo suyo (el acceso "lead" ya no da permisos extra)
export const isLead = (u) => isAdmin(u);
