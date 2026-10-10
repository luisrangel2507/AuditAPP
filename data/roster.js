// Roster inicial transcrito de la foto "Programa Auditoría LPA" (semana 5-Oct-2026).
// ⚠️ Es una transcripción de una foto: revisar nombres, días y áreas en Admin → Usuarios.
//
// Modelo: el DÍA de cada auditor es fijo (days: 1=Lun … 5=Vie) y el ÁREA rota semana a semana
// recorriendo `pool` desde `start` (la semana de referencia es REF_MONDAY, la de la foto).
// rotateDaily=true → además cambia de área cada día dentro de la misma semana (PE).
// Layer 2 y 3 no tienen día fijo: una auditoría por semana en "All Areas" (vence el viernes).

const ZONES = ['ZONA A', 'ZONA B', 'ZONA C', 'ZONA D-E'];
const QE_POOL = ['780B Door Trim', '780B Instrument Panel', '780B OB Registers', '780B Microphone Off Line', 'E2-6 41883A01', 'T1-XX2 Armrest'];
const OJT_POOL = ['A1-9', 'A2-3', 'A2-4', '780B Instrument Panel', '780B OB Registers', 'T1-XX2 Armrest'];
const MOLD_POOL = Array.from({ length: 13 }, (_, i) => `B1-${i + 1}`);
const PAINT_POOL = ['PL', 'Mix Room'];
const HR_POOL = ['5S', 'B1-14', 'B1-15', 'B2-1', 'B2-2'];
const ALL = ['All Areas'];
const ALL_DAYS = [1, 2, 3, 4, 5];

const REF_MONDAY = '2026-10-05';

// [nombre, dept, layer, plantilla (data/question-bank.json), days, pool, start, rotateDaily, access]
const ROSTER = [
  // Layer 3
  ['Juventino Morales', 'management', 3, 'General Manager', [], ALL, 0, false, 'lead'],

  // Layer 2 (managers) – "All Areas"
  ['Aldo Esquivel', 'quality', 2, 'Quality Manager', [], ALL, 0, false, 'lead'],
  ['Juan Olalde', 'maintenance', 2, 'Production Manager', [], ALL, 0, false, 'lead'],
  ['Scott Coulter', 'toolroom', 2, 'Production Manager', [], ALL, 0, false, 'lead'],
  ['Omar Sánchez', 'toolroom', 2, 'Production Manager', [], ALL, 0, false, 'lead'],
  ['Trevor Peers', 'production', 2, 'Production Manager', [], ALL, 0, false, 'lead'],
  ['Armando Martinez', 'production', 2, 'Production Manager', [], ALL, 0, false, 'lead'],
  ['Emmanuel Delgado', 'production', 2, 'Production Manager', [], ALL, 0, false, 'lead'],
  ['Mario Cupich', 'production', 2, 'Production Manager', [], ALL, 0, false, 'lead'],
  ['Hugo Arriaga', 'production', 2, 'Production Manager', [], ALL, 0, false, 'lead'],
  ['Paloma Herrera', 'hr', 2, 'HR Coordinator', [], ALL, 0, false, 'lead'],
  ['Jonathan Kebick', 'process', 2, 'Process Engineer', [], ALL, 0, false, 'lead'],
  ['Eduardo Pinto', 'process', 2, 'Process Engineer', [], ALL, 0, false, 'lead'],
  ['Fabiola Marina', 'logistics', 2, 'Shipping Supervisor', [], ALL, 0, false, 'lead'],
  ['Anahi Aguilar', 'program', 2, 'Process Audit', [], ALL, 0, false, 'lead'],
  ['Diego Mandujano', 'program', 2, 'Process Audit', [], ALL, 0, false, 'lead'],

  // Layer 1 – Calidad (QE)
  ['David Castillo', 'quality', 1, 'Quality Engineer', [1], QE_POOL, 0, false, 'auditor'],
  ['Victor Ramírez', 'quality', 1, 'Quality Engineer', [2], QE_POOL, 1, false, 'auditor'],
  ['Diana Laureano', 'quality', 1, 'Quality Engineer', [3], QE_POOL, 3, false, 'auditor'],
  ['Luis E Rangel', 'quality', 1, 'Quality Engineer', [4], QE_POOL, 2, false, 'auditor'],
  ['Erika Izquierdo', 'quality', 1, 'Quality Engineer', [5], QE_POOL, 4, false, 'auditor'],
  ['Edwin Gama', 'quality', 1, 'Quality Engineer', [5], QE_POOL, 5, false, 'auditor'],

  // Layer 1 – Procesos (PE)
  ['Raúl Rodríguez', 'process', 1, 'Process Engineer', ALL_DAYS, ZONES, 1, true, 'auditor'],
  ['Fernando Cuevas', 'process', 1, 'Process Engineer', ALL_DAYS, ZONES, 3, true, 'auditor'],
  ['Itzel Chavez', 'process', 1, 'Process Engineer', ALL_DAYS, ZONES, 0, false, 'auditor'],

  // Layer 1 – Supervisores de producción (diario, zona rota por semana)
  ['Julia Olguín', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 0, false, 'auditor'],
  ['Hugo Martínez', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 0, false, 'auditor'],
  ['Ricardo Suarez', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 1, false, 'auditor'],
  ['Conrado Garcia', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 1, false, 'auditor'],
  ['Perla González', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 1, false, 'auditor'],
  ['Martin Sanchez', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 2, false, 'auditor'],
  ['Carlos Puga', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 2, false, 'auditor'],
  ['Luis Medina Lopez', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 2, false, 'auditor'],
  ['Roberto Rodriguez', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 3, false, 'auditor'],
  ['Sonia Romero', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 3, false, 'auditor'],
  ['Adolfo Francisco', 'production', 1, 'Supervisor', ALL_DAYS, ZONES, 3, false, 'auditor'],

  // Layer 1 – OJT
  ['Celina Zamora José', 'production', 1, 'Operator', [1], OJT_POOL, 0, false, 'auditor'],
  ['Ma. Engracia Hernández', 'production', 1, 'Operator', [2], OJT_POOL, 1, false, 'auditor'],
  ['Carmen Hernández', 'production', 1, 'Operator', [3], OJT_POOL, 2, false, 'auditor'],

  // Layer 1 – Mold Tech Supervisors (Process Tech)
  ['José Cruz Elias', 'process', 1, 'Set-up', [1], MOLD_POOL, 0, false, 'auditor'],
  ['Jesus Sánchez', 'process', 1, 'Set-up', [2], MOLD_POOL, 2, false, 'auditor'],
  ['Oscar Álvaro Pérez', 'process', 1, 'Set-up', [3], MOLD_POOL, 1, false, 'auditor'],
  ['Saúl Granados', 'process', 1, 'Set-up', [4], MOLD_POOL, 3, false, 'auditor'],
  ['Eder Hernández', 'process', 1, 'Set-up', [5], MOLD_POOL, 12, false, 'auditor'],

  // Layer 1 – Pintura
  ['Pablo García', 'production', 1, 'Paint Technician', [2], PAINT_POOL, 0, false, 'auditor'],
  ['Luis Hernández', 'process', 1, 'Cell Leader – Paint', [3], PAINT_POOL, 0, false, 'auditor'],
  ['Vania Rosas', 'process', 1, 'Cell Leader – Paint', [4], PAINT_POOL, 1, false, 'auditor'],

  // Layer 1 – Logística / Embarques
  ['Fernanda Gutierrez', 'logistics', 1, 'Material Handler', [1], ['Shipping'], 0, false, 'auditor'],
  ['Marco Polo López M', 'logistics', 1, 'Shipper', [1], ['Shipping + Docks'], 0, false, 'auditor'],
  ['Andres Cerecedo', 'logistics', 1, 'Shipper', [2], ['Shipping + Docks'], 0, false, 'auditor'],
  ['Edgar Galván', 'logistics', 1, 'Shipper', [3], ['Shipping + Docks'], 0, false, 'auditor'],
  ['Francisco Javier Padilla', 'logistics', 1, 'Shipper', [4], ['Shipping + Docks'], 0, false, 'auditor'],

  // Layer 1 – HR Generalists
  ['Dulce Sánchez', 'hr', 1, 'HR Coordinator', [1], HR_POOL, 0, false, 'auditor'],
  ['Arturo González', 'hr', 1, 'HR Coordinator', [2], HR_POOL, 1, false, 'auditor'],
  ['Dulce Nieves', 'hr', 1, 'HR Coordinator', [3], HR_POOL, 2, false, 'auditor'],
  ['Patricia Carrillo', 'hr', 1, 'HR Coordinator', [4], HR_POOL, 3, false, 'auditor'],
];

// Usuarios cuyo username no sale bien de "nombre.apellido"
const USERNAME_OVERRIDES = {
  'Marco Polo López M': 'marco.lopez',
  'Francisco Javier Padilla': 'francisco.padilla',
  'Celina Zamora José': 'celina.zamora',
  'Oscar Álvaro Pérez': 'oscar.alvaro',
  'José Cruz Elias': 'jose.cruz',
  'Ma. Engracia Hernández': 'engracia.hernandez',
  'Luis Medina Lopez': 'luis.medina',
  'Luis E Rangel': 'luis.rangel',
  'Anahi Aguilar': 'anahi.aguilar',
};

module.exports = { ROSTER, REF_MONDAY, USERNAME_OVERRIDES };
