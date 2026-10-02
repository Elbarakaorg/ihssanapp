export type ActivityEstimates = { distanceKm: number; activeCalories: number };

export function estimateActivity(steps: number): ActivityEstimates {
  const safeSteps = Number.isFinite(steps) ? Math.max(0, Math.floor(steps)) : 0;
  return {
    distanceKm: Math.round(safeSteps * 0.0007 * 10) / 10,
    activeCalories: Math.round(safeSteps * 0.04),
  };
}