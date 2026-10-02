import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import type { SavedMeasurement } from '@/features/health/measurement-repository';
import { palette } from '@/ui/palette';

export type ChartPeriod = '1W' | '1M' | '3M' | '1Y' | 'ALL';
type Props = { measurements: SavedMeasurement[]; large?: boolean; period?: ChartPeriod; metricKey?: string; referenceRanges?: unknown[] | null };
type Point = { measuredAt: string; value: number };

const formatLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function MetricTrendChart({ measurements, large = false, period = 'ALL', metricKey, referenceRanges }: Props) {
  const [width, setWidth] = useState(0);
  const periodDays: Record<ChartPeriod, number | null> = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365, ALL: null };
  const days = periodDays[period];
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
  const filtered = measurements.filter((measurement) => cutoff === null || new Date(measurement.measured_at).getTime() >= cutoff);
  const values = filtered.slice(0, 100).reverse();

  const systolic: Point[] = values.flatMap((measurement) => measurement.component_values?.systolic !== undefined
    ? [{ measuredAt: measurement.measured_at, value: measurement.component_values.systolic }]
    : []);
  const diastolic: Point[] = values.flatMap((measurement) => measurement.component_values?.diastolic !== undefined
    ? [{ measuredAt: measurement.measured_at, value: measurement.component_values.diastolic }]
    : []);
  const scalar: Point[] = values.flatMap((measurement) => measurement.numeric_value !== null
    ? [{ measuredAt: measurement.measured_at, value: measurement.numeric_value }]
    : []);

  const isDual = systolic.length > 0 || diastolic.length > 0;
  const primary = isDual ? systolic : scalar;
  const secondary = isDual ? diastolic : [];
  if (!primary.length) return null;
  const referenceLines = large ? getReferenceLines(metricKey, referenceRanges, filtered) : [];

  if (primary.length < 2) {
    const point = primary[primary.length - 1];
    const secondaryPoint = secondary[secondary.length - 1];
    return (
      <View style={[styles.singlePointRow, large && styles.singlePointRowLarge]}>
        <View style={styles.singleDot} />
        <Text style={styles.singleValue}>{point.value}{secondaryPoint ? ` / ${secondaryPoint.value}` : ''}</Text>
        <Text style={styles.singleDate}>{formatLabel(point.measuredAt)}</Text>
      </View>
    );
  }

  const toData = (points: Point[]) => points.map((point) => ({ value: point.value, label: large ? formatLabel(point.measuredAt) : undefined }));
  const primaryData = toData(primary);
  const secondaryData = secondary.length ? toData(secondary) : undefined;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.chartWrap}>
      {width > 0 ? (
        <LineChart
          adjustToWidth
          animateOnDataChange
          animationDuration={420}
          areaChart={!isDual}
          color={palette.forest}
          color1={palette.coral}
          curved
          data={primaryData}
          data2={secondaryData}
          dataPointsColor={palette.forest}
          dataPointsColor1={palette.coral}
          dataPointsRadius={large ? 4 : 0}
          dataPointsRadius1={large ? 4 : 0}
          disableScroll
          endFillColor={palette.forest}
          endOpacity={0}
          endSpacing={large ? 12 : 4}
          hideAxesAndRules={!large}
          hideDataPoints={!large}
          hideDataPoints1={!large}
          hideRules={!large}
          hideYAxisText={!large}
          height={large ? 180 : 56}
          initialSpacing={large ? 12 : 4}
          isAnimated
          showReferenceLine1={referenceLines.length > 0}
          referenceLine1Position={referenceLines[0]?.value}
          referenceLine1Config={referenceLineConfig(referenceLines[0]?.label)}
          showReferenceLine2={referenceLines.length > 1}
          referenceLine2Position={referenceLines[1]?.value}
          referenceLine2Config={referenceLineConfig(referenceLines[1]?.label)}
          showReferenceLine3={referenceLines.length > 2}
          referenceLine3Position={referenceLines[2]?.value}
          referenceLine3Config={referenceLineConfig(referenceLines[2]?.label)}
          rulesColor={palette.line}
          rulesThickness={1}
          startFillColor={palette.forest}
          startOpacity={0.22}
          thickness={large ? 3 : 2.4}
          thickness1={large ? 2.6 : 2.2}
          width={width}
          xAxisColor={palette.line}
          xAxisLabelTextStyle={styles.axisLabel}
          xAxisLabelTexts={large ? primaryData.map((point) => point.label ?? '') : undefined}
          xAxisThickness={large ? 1 : 0}
          yAxisLabelWidth={large ? 34 : 0}
          yAxisTextStyle={styles.axisLabel}
          yAxisThickness={0}
        />
      ) : null}
      {isDual ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendMark, { backgroundColor: palette.forest }]} /><Text style={styles.legendText}>Systolic</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendMark, { backgroundColor: palette.coral }]} /><Text style={styles.legendText}>Diastolic</Text></View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { width: '100%' },
  singlePointRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 32 },
  singlePointRowLarge: { minHeight: 60 },
  singleDot: { backgroundColor: palette.forest, borderRadius: 5, height: 10, width: 10 },
  singleValue: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  singleDate: { color: palette.muted, fontSize: 11 },
  legend: { flexDirection: 'row', gap: 14, marginTop: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  legendMark: { borderRadius: 4, height: 8, width: 8 },
  legendText: { color: palette.muted, fontSize: 10 },
  axisLabel: { color: palette.muted, fontSize: 9 },
});

function getReferenceLines(metricKey: string | undefined, ranges: unknown[] | null | undefined, measurements: SavedMeasurement[]) {
  if (!metricKey || !ranges?.length || metricKey === 'blood_pressure' || metricKey === 'inr') return [];
  const contexts = new Set(measurements.map((measurement) => measurement.context?.timing).filter(Boolean));
  if (metricKey === 'blood_glucose' && contexts.size !== 1) return [];
  const timing = metricKey === 'blood_glucose' ? [...contexts][0] : undefined;
  const thresholds = ranges.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (metricKey === 'blood_glucose' && row.context !== (timing === 'postprandial_1_2h' ? '1-2 hours after meal' : timing)) return [];
    if (metricKey === 'hba1c' && String(row.category).includes('individualized')) return [];
    return Object.entries(row).flatMap(([key, value]) => {
      if (typeof value !== 'number' || !/^(minimum|maximum)/.test(key)) return [];
      const converted = metricKey === 'blood_glucose' && key.includes('_mg_dl') && measurements[0]?.unit === 'mmol/L' ? value / 18.0182 : value;
      return [{ value: converted, label: String(row.category ?? 'Reference') }];
    });
  });
  return [...new Map(thresholds.map((threshold) => [threshold.value, threshold])).values()].sort((first, second) => first.value - second.value).slice(0, 3);
}

function referenceLineConfig(label: string | undefined) {
  return { color: '#87968D', thickness: 1, type: 'dashed', dashWidth: 4, dashGap: 4, labelText: label, labelTextStyle: { color: palette.muted, fontSize: 8 } };
}