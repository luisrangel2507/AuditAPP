// Zonas de auditoría de Layer 1 y de los QEs. En PL no se escoge máquina.
export const ZONES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C3', 'D1', 'D2', 'E2', 'PL1', 'PL3', 'PL4', 'Toolroom', 'Shipping', 'Receiving'];
export const NO_MACHINE = ['PL1', 'PL3', 'PL4', 'Toolroom', 'Shipping', 'Receiving'];

// Máquinas conocidas por zona (sugerencias; también se aprenden de lo capturado antes)
export const SEED_MACHINES = {
  A1: ['A1-9'], A2: ['A2-3', 'A2-4'],
  B1: Array.from({ length: 15 }, (_, i) => `B1-${i + 1}`),
  B2: ['B2-1', 'B2-2'], E2: ['E2-6'],
};

export const areaLabel = (zone, machine) => (NO_MACHINE.includes(zone) || !machine ? zone : `${zone} · ${machine}`);
