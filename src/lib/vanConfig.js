// Van size configuration — single source of truth
// Used by admin UI components for dropdowns and display labels

export const VAN_CONFIG = {
  swb:   { adminLabel: 'Small (SWB)',   customerLabel: 'small van',        capacityCuFt: 200, effectiveCuFt: 200,  sortOrder: 1 },
  mwb:   { adminLabel: 'Medium (MWB)',  customerLabel: 'medium van',       capacityCuFt: 320, effectiveCuFt: 320,  sortOrder: 2 },
  lwb:   { adminLabel: 'Large (LWB)',   customerLabel: 'large van',        capacityCuFt: 420, effectiveCuFt: 420,  sortOrder: 3 },
  luton: { adminLabel: 'Luton (3.5t)',  customerLabel: 'Luton van',        capacityCuFt: 671, effectiveCuFt: 671,  sortOrder: 4 },
  '7.5t':{ adminLabel: '7.5t Lorry',    customerLabel: '7.5 tonne lorry',  capacityCuFt: 1100, effectiveCuFt: 1100, sortOrder: 5 },
};

export const VAN_DB_VALUES = Object.keys(VAN_CONFIG).sort((a, b) => VAN_CONFIG[a].sortOrder - VAN_CONFIG[b].sortOrder);

export function getVanLabel(dbValue, context = 'admin') {
  const cfg = VAN_CONFIG[dbValue];
  if (!cfg) return dbValue;
  return context === 'customer' ? cfg.customerLabel : cfg.adminLabel;
}
