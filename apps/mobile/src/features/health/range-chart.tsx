import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { bandFor, niceTicks, type Band, type BandTone } from '@/features/health/chart-bands';
import { palette, themedStyles, useScheme } from '@/ui/palette';

export type RangePoint = { at: string; value: number; second?: number };
type Props = { points: RangePoint[]; bands: Band[]; unit?: string | null; dual?: boolean; height?: number };

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 38 };

const tones = (): Record<BandTone, string> => ({ good: palette.forest, watch: palette.gold, high: palette.coral, info: palette.muted });
const toneName: Record<BandTone, string> = { good: 'Within reference', watch: 'Worth watching', high: 'Needs attention', info: 'Reference' };

const dateLabel = (iso: string, long = false) => new Date(iso).toLocaleDateString(undefined, long ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });

/** Smooth monotone-ish path through points (Catmull-Rom to Bezier, clamped so it never overshoots the data range). */
function smooth(xy: [number, number][]) {
  if (xy.length < 3) return xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const [x0, y0] = xy[Math.max(i - 1, 0)];
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[i + 1];
    const [x3, y3] = xy[Math.min(i + 2, xy.length - 1)];
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    const c1y = Math.min(Math.max(y1 + (y2 - y0) / 6, lo), hi);
    const c2y = Math.min(Math.max(y2 - (y3 - y1) / 6, lo), hi);
    d += ` C${x1 + (x2 - x0) / 6},${c1y} ${x2 - (x3 - x1) / 6},${c2y} ${x2},${y2}`;
  }
  return d;
}

export default function RangeChart({ points, bands, unit, dual = false, height = HEIGHT }: Props) {
  useScheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const colors = tones();

  const layout = useMemo(() => {
    const all = points.flatMap((p) => (p.second !== undefined ? [p.value, p.second] : [p.value]));
    const bandEdges = bands.flatMap((b) => [b.from, b.to].filter((v): v is number => v !== null));
    // Bands only widen the axis modestly so one distant threshold does not flatten the data.
    const dataLo = Math.min(...all);
    const dataHi = Math.max(...all);
    const span = dataHi - dataLo || Math.abs(dataHi) * 0.1 || 1;
    const near = bandEdges.filter((v) => v >= dataLo - span && v <= dataHi + span);
    const lo = Math.min(dataLo, ...near) - span * 0.12;
    const hi = Math.max(dataHi, ...near) + span * 0.12;
    return { lo, hi };
  }, [points, bands]);

  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = height - PAD.top - PAD.bottom;
  const times = points.map((p) => new Date(p.at).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (i: number) => PAD.left + (t1 === t0 ? innerW / 2 : ((times[i] - t0) / (t1 - t0)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - layout.lo) / (layout.hi - layout.lo)) * innerH;

  const primaryXY = points.map((p, i) => [x(i), y(p.value)] as [number, number]);
  const secondXY = dual ? points.flatMap((p, i) => (p.second !== undefined ? [[x(i), y(p.second)] as [number, number]] : [])) : [];
  const line = smooth(primaryXY);
  const area = `${line} L${primaryXY[primaryXY.length - 1][0]},${PAD.top + innerH} L${primaryXY[0][0]},${PAD.top + innerH} Z`;
  const ticks = niceTicks(layout.lo, layout.hi, 4);
  const xTickIdx = points.length <= 5 ? points.map((_, i) => i) : [0, Math.round((points.length - 1) / 4), Math.round((points.length - 1) / 2), Math.round(((points.length - 1) * 3) / 4), points.length - 1];
  const xTicks = [...new Set(xTickIdx)];

  const select = (locationX: number) => {
    let best = 0;
    let dist = Infinity;
    primaryXY.forEach(([px], i) => {
      const d = Math.abs(px - locationX);
      if (d < dist) { dist = d; best = i; }
    });
    setActive(best);
  };

  const activePoint = active === null ? null : points[active];
  const activeBand = activePoint ? bandFor(activePoint.value, bands) : undefined;
  const usedTones = [...new Set(bands.map((b) => b.tone))];

  return (
    <View>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onResponderGrant={(e) => select(e.nativeEvent.locationX)}
        onResponderMove={(e) => select(e.nativeEvent.locationX)}
        onStartShouldSetResponder={() => true}
        style={{ height }}
      >
        {width > 0 ? (
          <Svg height={height} width={width}>
            <Defs>
              <LinearGradient id="rc-area" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={palette.forest} stopOpacity={0.24} />
                <Stop offset="1" stopColor={palette.forest} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {bands.map((band, i) => {
              const top = y(Math.min(band.to ?? layout.hi, layout.hi));
              const bottom = y(Math.max(band.from ?? layout.lo, layout.lo));
              if (bottom - top < 1) return null;
              return <Rect fill={colors[band.tone]} height={bottom - top} key={`${band.label}-${i}`} opacity={0.13} width={innerW} x={PAD.left} y={top} />;
            })}
            {ticks.map((tick) => (
              <G key={tick}>
                <Line stroke={palette.line} strokeDasharray="2 4" strokeWidth={1} x1={PAD.left} x2={PAD.left + innerW} y1={y(tick)} y2={y(tick)} />
                <SvgText fill={palette.muted} fontSize={10} textAnchor="end" x={PAD.left - 6} y={y(tick) + 3}>{tick}</SvgText>
              </G>
            ))}
            <Path d={area} fill="url(#rc-area)" />
            {secondXY.length > 1 ? <Path d={smooth(secondXY)} fill="none" stroke={palette.coral} strokeLinecap="round" strokeWidth={2.4} /> : null}
            <Path d={line} fill="none" stroke={palette.forest} strokeLinecap="round" strokeWidth={2.8} />
            {points.map((p, i) => {
              const tone = bandFor(p.value, bands)?.tone;
              return <Circle cx={primaryXY[i][0]} cy={primaryXY[i][1]} fill={tone ? colors[tone] : palette.forest} key={p.at + i} r={points.length > 40 ? 2.5 : 4.5} stroke={palette.white} strokeWidth={1.5} />;
            })}
            {xTicks.map((i) => (
              <SvgText fill={palette.muted} fontSize={10} key={`x${i}`} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} x={x(i)} y={height - 8}>{dateLabel(points[i].at)}</SvgText>
            ))}
            {active !== null ? (
              <G>
                <Line stroke={palette.ink} strokeOpacity={0.35} strokeWidth={1} x1={primaryXY[active][0]} x2={primaryXY[active][0]} y1={PAD.top} y2={PAD.top + innerH} />
                <Circle cx={primaryXY[active][0]} cy={primaryXY[active][1]} fill="none" r={8} stroke={palette.ink} strokeWidth={1.5} />
              </G>
            ) : null}
          </Svg>
        ) : null}
      </View>

      <View style={styles.readout}>
        {activePoint ? (
          <>
            <Text style={styles.readoutValue}>{activePoint.value}{activePoint.second !== undefined ? ` / ${activePoint.second}` : ''}{unit ? ` ${unit}` : ''}</Text>
            <Text style={styles.readoutMeta}>{dateLabel(activePoint.at, true)}{activeBand ? ` · ${activeBand.label}` : ''}</Text>
          </>
        ) : (
          <Text style={styles.readoutMeta}>Touch the chart to read a result.</Text>
        )}
      </View>

      {usedTones.length || dual ? (
        <View style={styles.legend}>
          {dual ? (
            <>
              <View style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: palette.forest }]} /><Text style={styles.legendText}>Systolic</Text></View>
              <View style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: palette.coral }]} /><Text style={styles.legendText}>Diastolic</Text></View>
            </>
          ) : null}
          {usedTones.map((tone) => (
            <View key={tone} style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: colors[tone], opacity: 0.55 }]} /><Text style={styles.legendText}>{toneName[tone]}</Text></View>
          ))}
        </View>
      ) : null}
      {usedTones.length ? <Text style={styles.note}>Shaded bands show published reference categories, not a diagnosis or a personal target.</Text> : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  readout: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, minHeight: 24 },
  readoutValue: { color: palette.ink, fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '600' },
  readoutMeta: { color: palette.muted, fontSize: 12 },
  legend: { columnGap: 14, flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 4 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  swatch: { borderRadius: 3, height: 8, width: 14 },
  legendText: { color: palette.muted, fontSize: 11 },
  note: { color: palette.muted, fontSize: 10, fontStyle: 'italic', marginTop: 6 },
}));
