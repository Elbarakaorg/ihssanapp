export type Provider = {
  id: string;
  kind: 'doctor' | 'pharmacy';
  name: string;
  specialty: string | null;
  city: string;
  address: string | null;
  phone: string | null;
  opening_hours: string | null;
  latitude: number;
  longitude: number;
};

export type ProviderMapProps = {
  providers: Provider[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export const MOROCCO_CENTER = { latitude: 31.79, longitude: -7.09 };
