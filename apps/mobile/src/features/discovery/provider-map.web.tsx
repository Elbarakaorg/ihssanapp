import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AdvancedMarker, APIProvider, Map, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

import { MOROCCO_CENTER, type ProviderMapProps } from './provider-types';

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

function Viewport({ providers, selectedId }: Pick<ProviderMapProps, 'providers' | 'selectedId'>) {
  const map = useMap();
  const core = useMapsLibrary('core');
  useEffect(() => {
    if (!map || !core) return;
    const selected = providers.find((item) => item.id === selectedId);
    if (selected) {
      map.panTo({ lat: selected.latitude, lng: selected.longitude });
      map.setZoom(14);
    } else if (providers.length) {
      const bounds = new core.LatLngBounds();
      providers.forEach((item) => bounds.extend({ lat: item.latitude, lng: item.longitude }));
      map.fitBounds(bounds, 80);
    }
  }, [map, core, providers, selectedId]);
  return null;
}

export default function ProviderMap({ providers, selectedId, onSelect }: ProviderMapProps) {
  if (!apiKey) {
    return (
      <View style={styles.missing}>
        <Text>Map is not configured. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.</Text>
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={{ lat: MOROCCO_CENTER.latitude, lng: MOROCCO_CENTER.longitude }}
          defaultZoom={6}
          disableDefaultUI
          gestureHandling="greedy"
          mapId={process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID'}
          onClick={() => onSelect(null)}
          zoomControl>
          <Viewport providers={providers} selectedId={selectedId} />
          {providers.map((item) => (
            <AdvancedMarker key={item.id} onClick={() => onSelect(item.id)} position={{ lat: item.latitude, lng: item.longitude }} title={item.name}>
              <Pin background={item.kind === 'doctor' ? '#1F6B4F' : '#D9604A'} borderColor="#ffffff" glyphColor="#ffffff" />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
});
