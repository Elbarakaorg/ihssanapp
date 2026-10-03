import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AdvancedMarker, APIProvider, Map, Pin, useMap } from '@vis.gl/react-google-maps';

import { DEFAULT_CENTER, pinColors, type ProviderMapProps } from './provider-types';

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

function Viewport({ pins, selectedId, onCenterChange }: Pick<ProviderMapProps, 'pins' | 'selectedId' | 'onCenterChange'>) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('idle', () => {
      const center = map.getCenter();
      if (center) onCenterChange({ latitude: center.lat(), longitude: center.lng() });
    });
    return () => listener.remove();
  }, [map, onCenterChange]);
  useEffect(() => {
    const selected = pins.find((item) => item.id === selectedId);
    if (map && selected) {
      map.panTo({ lat: selected.latitude, lng: selected.longitude });
      if ((map.getZoom() ?? 0) < 14) map.setZoom(14);
    }
  }, [map, pins, selectedId]);
  return null;
}

export default function ProviderMap({ pins, selectedId, onSelect, onCenterChange }: ProviderMapProps) {
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
          defaultCenter={{ lat: DEFAULT_CENTER.latitude, lng: DEFAULT_CENTER.longitude }}
          defaultZoom={13}
          disableDefaultUI
          gestureHandling="greedy"
          mapId={process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID'}
          onClick={() => onSelect(null)}
          zoomControl>
          <Viewport onCenterChange={onCenterChange} pins={pins} selectedId={selectedId} />
          {pins.map((item) => (
            <AdvancedMarker key={item.id} onClick={() => onSelect(item.id)} position={{ lat: item.latitude, lng: item.longitude }} title={item.title}>
              <Pin background={item.onDuty ? '#F2B01E' : pinColors[item.kind]} borderColor="#ffffff" glyphColor="#ffffff" />
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
