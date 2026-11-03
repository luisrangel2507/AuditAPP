// Textos de encabezado de cada formato corporativo (MGMT-015-C), tal como vienen impresos en cada hoja
const D = (r, t = 'Perform Layer 1 audit daily and document any findings and corrections made below.') => [r, t];
const REV = (r) => [r, 'Reviews Layer 1 Audit Daily & Signs-off'];
const DOC = (r) => [r, 'Document any findings and corrections made below.'];
const L2 = (r) => [r, 'Perform Layer 2 audit weekly and document any findings and corrections on that form.'];
const L3 = (r = 'General Manager') => [r, 'Perform Layer 3 audit monthly and document any findings and corrections on that form.'];
const L4 = (r) => [r, 'Perform Layer 4 audit quarterly and document any findings and corrections on that form.'];
const PROD = { left: [D('Supervisor'), REV('Production Manager'), DOC('Production Manager')], right: [L2('Production Manager'), L3(), L4('Director of Operations')] };
const mk = (base, over) => ({ ...base, ...over });

export const FORM_META = {
  'QE Layer 1 Audit': { left: [D('QE', 'Perform Layer 1 audit daily and document any findings and corrections made below.'), REV('Quality Manager'), DOC('Quality Manager')], right: [L2('Quality Manager'), L3(), L4('Director of Quality')], signoff: 'Quality Manager Sign Off' },
  'QA Layer 2 Audit': { left: [D('QE', 'Perform Layer 1 audit daily and document any findings and corrections.'), REV('Quality Manager'), DOC('Quality Manager')], right: [L2('Quality Manager'), L3(), L4('Director of Quality')], signoff: 'General Manager Sign Off', hdr: 'Layer 2 – Weekly by Dept. Manager' },
  'Matl / Logistics Layer 2 Audit': { left: [D('Shipping Supervisor', 'Perform Layer 1 audit daily and document any findings and corrections.'), REV('Materials / Logistics Manager'), DOC('Materials / Logistics Manager')], right: [L2('Materials / Logistics Manager'), L3(), L4('Director of Finance')], signoff: 'General Manager Sign Off', hdr: 'Layer 2 – Weekly by Dept. Manager' },
  'GM Layer 3 Audit': mk(PROD, { signoff: 'Director Sign Off', hdr: 'Layer 3 – Monthly by General Manager' }),
  'Tool Shop Layer 2 Audit': { left: null, right: [L2('Tool Shop Supervisor'), L4('Tool Shop Manager')], signoff: 'Tool Shop Manager Sign Off', hdr: 'Layer 2 – Weekly by Tool Shop Supervisor', numbered: true },
  'Maint Layer 2 Audit': { left: null, right: [L2('Maintenance Manager'), L3(), L4('Director of Operations')], signoff: 'General Manager Sign Off', hdr: 'Layer 2 – Weekly by Dept. Manager', numbered: true },
  'PE Layer 2 Audit': { left: [D('PE'), REV('PE Manager'), DOC('PE Manager')], right: [L2('PE Manager'), L3(), L4('Director of Operations')], signoff: 'General Manager Sign Off', hdr: 'Layer 2 – Weekly by Dept. Manager' },
  'PE Layer 1 LPA': { left: [D('PE'), REV('PE Manager'), DOC('PE Manager')], right: [L2('PE Manager'), L3(), L4('Director of Operations')], signoff: 'Process Engineering Manager Sign Off', hdr: 'Layer 1 – Daily by Process Engineer' },
  'HR Layer 1 Audit': mk(PROD, { signoff: 'HR Manager Sign Off', hdr: 'Layer 1 – Daily by Supervisor' }),
  'HR Layer 2 Audit': { left: null, right: [L2('HR Manager / Coordinator'), L3(), L4('Director of Human Resources')], signoff: 'General Manager Sign Off', hdr: 'Layer 2 – Weekly by Dept. Manager', numbered: true },
  'Project Layer 2 Audit': { left: [D('Project Eng.'), REV('Project Manager'), DOC('Project Eng')], right: [L2('Project Manager'), L3(), L4('Director of Quality')], signoff: 'Project Manager Sign Off', hdr: 'Layer 1 – Weekly' },
  'Production Layer 2 Audit': mk(PROD, { signoff: 'Operations Manager Sign Off', hdr: 'Layer 2 – Weekly by Dept. Manager' }),
  'Production Layer 2 Audit (Short)': mk(PROD, { signoff: 'General Manager Sign Off', hdr: 'Layer 2 – Weekly by Dept. Manager' }),
  'Paint Layer 2 Audit': mk(PROD, { signoff: 'General Manager Sign Off', hdr: 'Layer 2 – Weekly by Dept. Manager' }),
  'Paint Line Layer 1 Audit': mk(PROD, { signoff: 'Production Manager Sign Off', hdr: 'Layer 1 – Daily by Supervisor' }),
  'Production Cells Layer 1 Audit': mk(PROD, { signoff: 'Production Manager Sign Off', hdr: 'Layer 1 – Daily by Supervisor' }),
  'OJT Layer 1 Audit': { left: [D('OJT'), REV('Production Manager'), DOC('Production Manager')], right: [L2('Production Manager'), L3(), L4('VP / Director of US Operations')], signoff: 'Supervisor Sign Off', hdr: 'Layer 1 – Daily by Supervisor' },
  'Process Tech Layer 1 Audit': { left: [D('Process Tech'), REV('Supervisor'), DOC('Process Tech')], right: [L2('Production Manager'), L3(), L4('VP / Director of US Operations')], signoff: 'Supervisor Sign Off', hdr: 'Layer 1 – Daily by Supervisor' },
  'Shipping Layer 1 Audit': { left: [D('Shipping Supervisor', 'Perform Layer 1 audit daily and document any findings and corrections.'), REV('Materials / Logistics Manager'), DOC('Materials / Logistics Manager')], right: [L2('Materials / Logistics Manager'), L3(), L4('Director of Finance')], signoff: 'Materials & Logistics Manager Sign Off', hdr: 'Layer 1 – Daily by Shipping Supervisor' },
};
FORM_META['Shipping Layer 1 Audit (Customer Service)'] = FORM_META['Shipping Layer 1 Audit'];
export const metaFor = (name) => FORM_META[name] || FORM_META['QE Layer 1 Audit'];
