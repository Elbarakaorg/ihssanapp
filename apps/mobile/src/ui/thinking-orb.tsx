// Native build, adapted from thinking-orbs-native (MIT, © Jakub Antalik). Geometry comes from the
// published `thinking-orbs/engine`; this file only turns each frame's dot list into Skia draw calls.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, View } from 'react-native';
import { Canvas, PaintStyle, Picture, Skia, createPicture, type SkPicture } from '@shopify/react-native-skia';
import { MODE_FRAMES, resolvePreset } from 'thinking-orbs/engine';

import { useScheme } from '@/ui/palette';
import type { OrbProps } from '@/ui/thinking-orb-types';

const REDUCED_MOTION_T = 0.6;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive) setReduced(value); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduced;
}

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next !== 'background'));
    return () => sub.remove();
  }, []);
  return active;
}

export function ThinkingOrb({ state = 'working', size = 20, paused = false, label }: OrbProps) {
  const dark = useScheme() === 'dark';
  const reduced = useReducedMotion();
  const appActive = useAppActive();
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const paints = useMemo(() => ({ fill: Skia.Paint(), stroke: Skia.Paint() }), []);
  const rgba = useRef(new Float32Array(4)).current;
  const { mode, speed, opts } = useMemo(() => resolvePreset(state, size), [state, size]);

  useEffect(() => {
    const { fill, stroke } = paints;
    fill.setAntiAlias(true);
    stroke.setAntiAlias(true);
    stroke.setStyle(PaintStyle.Stroke);
    const build = MODE_FRAMES[mode];

    const setInk = (paint: typeof fill, white: number, alpha: number) => {
      const w = Math.min(1, Math.max(0, white));
      const g = Math.round((dark ? 1 - w : w) * 255) / 255;
      rgba[0] = g; rgba[1] = g; rgba[2] = g; rgba[3] = alpha;
      paint.setColor(rgba);
    };
    const record = (t: number) => {
      const frame = build(size, t, opts);
      setPicture(createPicture((canvas) => {
        for (const l of frame.lines) {
          setInk(stroke, l.white, l.a ?? 1);
          stroke.setStrokeWidth(l.w);
          canvas.drawLine(l.x1, l.y1, l.x2, l.y2, stroke);
        }
        for (const d of frame.dots) {
          setInk(fill, d.white, d.a ?? 1);
          canvas.drawCircle(d.x, d.y, d.r, fill);
        }
      }, Skia.XYWHRect(0, 0, size, size)));
    };

    if (reduced) { record(REDUCED_MOTION_T); return; }
    record((performance.now() / 1000) * speed);
    if (paused || !appActive) return;

    let raf = 0;
    let running = true;
    const loop = () => {
      record((performance.now() / 1000) * speed);
      if (running) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [mode, opts, size, dark, speed, paused, reduced, appActive, paints, rgba]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label ?? 'Loading'} style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>{picture ? <Picture picture={picture} /> : null}</Canvas>
    </View>
  );
}
