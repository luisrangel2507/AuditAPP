// Encargados: quien tiene acceso "Encargado" (lead) y es Layer 2, 3 o 4 ve (solo lectura) lo de su equipo:
//   Layer 2 → personas de menor capa de SU departamento; Layer 3 y 4 → de menor capa de cualquier departamento. Siempre en su planta.
export const isTeamLead = (u) => u?.access === 'lead' && Number(u?.layer) >= 2;
export const canSeeTeamUser = (u, t) => isTeamLead(u) && u.site_id != null && u.site_id === t.site_id && Number(t.layer) < Number(u.layer) && (Number(u.layer) >= 3 || t.dept === u.dept);
// Fragmento SQL: `col` son los alias de users (u.layer, u.dept, u.site_id); `lay`, `dep`, `site` son los placeholders ($n)
export const teamSql = (alias, lay, dep, site) => `(${alias}.layer < ${lay} AND (${lay} >= 3 OR ${alias}.dept = ${dep}) AND ${alias}.site_id = ${site})`;
