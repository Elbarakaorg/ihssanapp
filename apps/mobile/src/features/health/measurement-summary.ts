export type MeasurementSummaryEntry = {
  measured_at: string;
};

export function summarizeMeasurements(measurements: Array<MeasurementSummaryEntry>): { count: number; latestMeasurementDate: string | null } {
  if (!measurements.length) {
    return { count: 0, latestMeasurementDate: null };
  }

  const latestMeasurementDate = measurements.reduce((latest, current) => {
    return current.measured_at > latest ? current.measured_at : latest;
  }, measurements[0].measured_at);

  return { count: measurements.length, latestMeasurementDate };
}
