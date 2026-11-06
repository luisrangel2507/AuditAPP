// Zonas de auditoría de Layer 1 y de los QEs. En PL no se escoge máquina.
export const ZONES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C3', 'D1', 'D2', 'E2', 'PL1', 'PL3', 'PL4', 'Toolroom', 'Shipping', 'Receiving', 'QIA', 'Proveedores'];
export const NO_MACHINE = ['PL1', 'PL3', 'PL4', 'Toolroom', 'Shipping', 'Receiving', 'QIA', 'Proveedores'];

// Máquinas activas por zona (lista de prensas de PLEX MPQ). Las inactivas no se programan ni se sugieren
const rng = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`);
export const INACTIVE_MACHINES = ['C3-10', 'HINGE'];
export const SEED_MACHINES = {
  A1: rng('A1-', 1, 9), A2: rng('A2-', 1, 5),
  B1: ['B1-0', ...rng('B1-', 1, 10), ...rng('B1-', 12, 15)], B2: [...rng('B2-', 1, 7), 'B4'],
  C1: rng('C1-', 1, 12), C2: ['B1-11', ...rng('C2-', 5, 12), ...rng('D1-', 1, 3)], C3: rng('C2-', 1, 4),
  D1: ['D1-9', 'D1-10'], D2: rng('D2-', 1, 7), E2: rng('E2-', 1, 8),
};
export const isActiveMachine = (m) => !INACTIVE_MACHINES.includes(String(m).toUpperCase());

export const areaLabel = (zone, machine) => (NO_MACHINE.includes(zone) || !machine ? zone : `${zone} · ${machine}`);

// Orden por zonas: A, A1, A2, B, B1, B2, C…, D…, E, E2, PL1, PL3, PL4 y al final lo demás (Shipping, Mix Room…)
const ZORDER = ['A', 'A1', 'A2', 'B', 'B1', 'B2', 'C', 'C1', 'C2', 'C3', 'D', 'D1', 'D2', 'E', 'E2', 'PL', 'PL1', 'PL3', 'PL4', 'TOOLROOM', 'SHIPPING', 'RECEIVING', 'QIA', 'PROVEEDORES'];
export const zoneRank = (area) => {
  const a = String(area || '').toUpperCase().trim();
  let z = '';
  let m = /^ZONA ([A-E])\b/.exec(a); if (m) z = m[1];                       // "ZONA D-E" → D
  if (!z) { m = /^(PL[134]?|TOOLROOM|SHIPPING|RECEIVING|QIA|PROVEEDORES)\b/.exec(a); if (m) z = m[1]; }                  // PL, PL1, PL3, PL4
  if (!z) { m = /^([A-E][0-9])\b/.exec(a); if (m) z = m[1]; }                // "B2 · B2-1", "B2-2" → B2
  if (!z) { m = /^([A-E])\b/.exec(a); if (m) z = m[1]; }
  const i = ORDER_IDX[z];
  return i === undefined ? 99 : i;
};
const ORDER_IDX = Object.fromEntries(ZORDER.map((z, i) => [z, i]));

// Ensambles offline (líneas de ensamble fuera de prensa). Falta ubicarlos en su zona.
export const OFFLINE_ASSEMBLIES = [
  '400D Assy Line', 'CASE-MICROPHONE', '780-CTR PANEL', 'GARNISH-920B', 'Instrument PANEL',
  'T1-XX2 ARMREST', 'MP-SHIFTER/END CAP BEZEL', '780B-Garnish Frame Bracket', 'CX727-DSMIDTOP', 'CX727-SOUNDBAR',
];
