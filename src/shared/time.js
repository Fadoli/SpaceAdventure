export function calculateBaseTime(entity) {
  const cost = entity.baseCost;
  if (!cost) {
    return 0;
  }
  return (cost.metal || 0) * 1 + (cost.crystal || 0) * 1.5 + (cost.deuterium || 0) * 3;
}
