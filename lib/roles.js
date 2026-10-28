// Jerarquía de roles:
//   master  → global (sin planta): activa/pausa plantas, nombra administradores, ve todas las plantas
//   admin   → de una planta: gestiona usuarios, roles, asignaciones y ve el Panel de su planta
//   lead / auditor → solo ven su propia información
export const isMaster = (u) => u?.access === 'master';
export const isAdmin = (u) => u?.access === 'admin' || u?.access === 'master';
export const ROLE_LABEL = { master: 'Máster', admin: 'Administrador', lead: 'Auditor y encargado', auditor: 'Auditor' };
export const LAYERS = [1, 2, 3, 4];
// Con una sola planta el máster se presenta como Administrador
export const roleLabel = (u) => (u.access === 'master' && !u.multi_site ? ROLE_LABEL.admin : ROLE_LABEL[u.access]);
