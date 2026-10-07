import type { RuntimePin } from './map-logic';
import type { MapEvent, MapTheme } from './map-runtime';

export type MapboxViewProps = {
  token: string;
  styleUrl: string;
  theme: MapTheme;
  pins: RuntimePin[];
  user: { lat: number; lng: number } | null;
  mode: '2d' | '3d';
  fly: { lat: number; lng: number; zoom: number; key: number } | null;
  selectedId: string | null;
  onEvent: (event: MapEvent) => void;
};
