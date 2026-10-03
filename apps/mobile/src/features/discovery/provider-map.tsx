import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { MOROCCO_CENTER, type ProviderMapProps } from './provider-types';

export default function ProviderMap({ providers, selectedId, onSelect }: ProviderMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const selected = providers.find((item) => item.id === selectedId);
    if (selected) {
      mapRef.current?.animateToRegion({ latitude: selected.latitude, longitude: selected.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 350);
    } else if (providers.length > 1) {
      mapRef.current?.fitToCoordinates(providers, { animated: true, edgePadding: { top: 160, right: 50, bottom: 120, left: 50 } });
    }
  }, [providers, selectedId]);

  return (
    <MapView
      initialRegion={{ ...MOROCCO_CENTER, latitudeDelta: 9, longitudeDelta: 9 }}
      onPress={() => onSelect(null)}
      provider={PROVIDER_GOOGLE}
      ref={mapRef}
      showsUserLocation
      style={StyleSheet.absoluteFill}>
      {providers.map((item) => (
        <Marker
          coordinate={{ latitude: item.latitude, longitude: item.longitude }}
          key={item.id}
          onPress={() => onSelect(item.id)}
          pinColor={item.kind === 'doctor' ? '#1F6B4F' : '#D9604A'}
          title={item.name}
        />
      ))}
    </MapView>
  );
}
