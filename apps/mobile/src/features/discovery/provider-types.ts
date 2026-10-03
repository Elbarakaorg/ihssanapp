export type MapPin = {
  id: string;
  kind: 'pharmacy' | 'hospital' | 'clinic' | 'doctor';
  latitude: number;
  longitude: number;
  title: string;
  onDuty: boolean;
};

export type ProviderMapProps = {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userLocation: { latitude: number; longitude: number } | null;
  focus: { latitude: number; longitude: number; key: number } | null;
  onCenterChange: (center: { latitude: number; longitude: number }) => void;
};

export const DEFAULT_CENTER = { latitude: 33.5731, longitude: -7.5898 };

export const pinColors: Record<MapPin['kind'], string> = {
  pharmacy: '#1F6B4F',
  hospital: '#2C5DA8',
  clinic: '#7A4BA8',
  doctor: '#D9604A',
};
