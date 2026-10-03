export type PlaceKind = 'pharmacy' | 'hospital' | 'clinic';

export type CarePlace = {
  placeId: string;
  kind: PlaceKind;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  latitude: number;
  longitude: number;
};

export type PlacesClient = {
  searchNearby(input: { latitude: number; longitude: number; radiusMeters: number; kind: PlaceKind | 'all'; language: string }): Promise<CarePlace[]>;
  searchText(input: { query: string; latitude?: number; longitude?: number; language: string }): Promise<CarePlace[]>;
};

const placesBaseUrl = 'https://places.googleapis.com/v1';
// No opening hours or ratings are requested: guard status comes from Hirassa, and the field mask keeps cost down.
const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.primaryType,places.types,places.addressComponents';
const typesByKind: Record<PlaceKind | 'all', string[]> = {
  pharmacy: ['pharmacy'],
  hospital: ['hospital'],
  clinic: ['medical_clinic', 'doctor'],
  all: ['pharmacy', 'hospital', 'medical_clinic', 'doctor'],
};
const searchableHealthTypes = new Set(['hospital', 'doctor', 'medical_clinic', 'dental_clinic', 'dentist', 'physiotherapist', 'medical_lab', 'health']);

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  primaryType?: string;
  types?: string[];
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
};

export function createGooglePlacesClient(apiKey: string, fetchImpl: typeof fetch = fetch): PlacesClient {
  async function post(path: string, body: unknown): Promise<GooglePlace[]> {
    const response = await fetchImpl(`${placesBaseUrl}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fieldMask },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Places request failed with status ${response.status}.`);
    const payload = (await response.json()) as { places?: GooglePlace[] };
    return payload.places ?? [];
  }

  return {
    async searchNearby({ latitude, longitude, radiusMeters, kind, language }) {
      const places = await post('places:searchNearby', {
        includedTypes: typesByKind[kind],
        maxResultCount: 20,
        rankPreference: 'DISTANCE',
        languageCode: language,
        regionCode: 'MA',
        locationRestriction: { circle: { center: { latitude, longitude }, radius: radiusMeters } },
      });
      return places.flatMap((place) => normalizePlace(place));
    },
    async searchText({ query, latitude, longitude, language }) {
      const places = await post('places:searchText', {
        textQuery: query,
        maxResultCount: 10,
        languageCode: language,
        regionCode: 'MA',
        ...(latitude !== undefined && longitude !== undefined
          ? { locationBias: { circle: { center: { latitude, longitude }, radius: 30000 } } }
          : {}),
      });
      return places
        .filter((place) => (place.types ?? []).some((type) => searchableHealthTypes.has(type)))
        .flatMap((place) => normalizePlace(place));
    },
  };
}

function normalizePlace(place: GooglePlace): CarePlace[] {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (!place.id || !place.displayName?.text || typeof latitude !== 'number' || typeof longitude !== 'number') return [];
  const types = place.types ?? [];
  const kind: PlaceKind = types.includes('pharmacy') ? 'pharmacy' : types.includes('hospital') ? 'hospital' : 'clinic';
  const city = place.addressComponents?.find((part) => part.types?.includes('locality'))?.longText ?? '';
  return [{
    placeId: place.id,
    kind,
    name: place.displayName.text,
    address: place.formattedAddress ?? '',
    city,
    phone: place.nationalPhoneNumber ?? null,
    latitude,
    longitude,
  }];
}
