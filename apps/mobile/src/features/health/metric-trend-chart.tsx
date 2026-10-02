import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import type { SavedMeasurement } from '@/features/health/measurement-repository';
import { palette, themedStyles, useScheme } from '@/ui/palette';

export type ChartPeriod = '1W' | '1M' | '3M' | '1Y' | 'ALL';
type Props = { measurements: SavedMeasurement[]; large?: boolean; period?: ChartPeriod; metricKey?: string; referenceRanges?: unknown[] | null; unit?: string | null };
type Point = { measuredAt: string; value: number };

const formatLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function MetricTrendChart({ measurements, large = false, period = 'ALL', metricKey, referenceRanges, unit }: Props) {
  useScheme();
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
  if (!primary.length) {
    return large ? <View style={styles.emptyPeriod}><Text style={styles.singleDate}>No results in this period.</Text></View> : null;
  }
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

  const toData = (points: Point[]) => points.map((point, index) => ({
    value: point.value,
    date: new Date(point.measuredAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    // Thin the axis so labels never collide on dense histories.
    label: large && (points.length <= 6 || index % Math.ceil(points.length / 5) === 0) ? formatLabel(point.measuredAt) : '',
  }));
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
          pointerConfig={large ? pointerConfig(unit, secondaryData) : undefined}
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
          xAxisLabelTexts={large ? primaryData.map((point) => point.label) : undefined}
          xAxisThickness={large ? 1 : 0}
          yAxisLabelWidth={large ? 34 : 0}
          yAxisTextStyle={styles.axisLabel}
          yAxisThickness={0}
        />
      ) : null}
      {large ? <Stats isDual={isDual} primary={primary} secondary={secondary} unit={unit} /> : null}
      {isDual ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendMark, { backgroundColor: palette.forest }]} /><Text style={styles.legendText}>Systolic</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendMark, { backgroundColor: palette.coral }]} /><Text style={styles.legendText}>Diastolic</Text></View>
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  chartWrap: { width: '100%' },
  emptyPeriod: { alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  stats: { borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', marginTop: 14, paddingTop: 12 },
  stat: { flex: 1 },
  statLabel: { color: palette.muted, fontSize: 11 },
  statValue: { color: palette.ink, fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '500', marginTop: 2 },
  tooltip: { backgroundColor: palette.ink, borderCurve: 'continuous', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  tooltipValue: { color: palette.paper, fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '600' },
  tooltipDate: { color: palette.paper, fontSize: 10, opacity: 0.7 },
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
}));

const round = (value: number) => Math.round(value * 10) / 10;

function Stats({ isDual, primary, secondary, unit }: { isDual: boolean; primary: Point[]; secondary: Point[]; unit?: string | null }) {
  const average = (points: Point[]) => points.reduce((sum, point) => sum + point.value, 0) / points.length;
  const suffix = isDual ? ' mm Hg' : unit ? ` ${unit}` : '';
  const items = isDual && secondary.length
    ? [['Average', `${round(average(primary))} / ${round(average(secondary))}`], ['Readings', String(primary.length)]]
    : [['Lowest', String(round(Math.min(...primary.map((point) => point.value))))], ['Average', String(round(average(primary)))], ['Highest', String(round(Math.max(...primary.map((point) => point.value))))]];
  return (
    <View style={styles.stats}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.stat}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statValue}>{value}{label === 'Readings' ? '' : suffix}</Text>
        </View>
      ))}
    </View>
  );
}

function pointerConfig(unit: string | null | undefined, secondary: { value: number }[] | undefined) {
  return {
    activatePointersOnLongPress: false,
    autoAdjustPointerLabelPosition: true,
    pointerColor: palette.forest,
    pointerLabelHeight: 56,
    pointerLabelWidth: 110,
    pointerStripColor: palette.line,
    pointerStripHeight: 180,
    pointerStripWidth: 1,
    radius: 5,
    pointerLabelComponent: (items: { value: number; date?: string }[], secondaryItems?: { value: number }[], pointerIndex?: number) => {
      const second = secondaryItems?.[0]?.value ?? secondary?.[pointerIndex ?? -1]?.value;
      return (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipValue}>{items[0].value}{second !== undefined ? ` / ${second}` : ''}{unit && second === undefined ? ` ${unit}` : ''}</Text>
          <Text style={styles.tooltipDate}>{items[0].date}</Text>
        </View>
      );
    },
  };
}

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