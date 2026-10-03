import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { DEFAULT_CENTER, pinColors, type ProviderMapProps } from './provider-types';

export default function ProviderMap({ pins, selectedId, onSelect, onCenterChange, userLocation, focus }: ProviderMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const selected = pins.find((item) => item.id === selectedId);
    if (selected) {
      mapRef.current?.animateToRegion({ latitude: selected.latitude, longitude: selected.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 350);
    }
  }, [pins, selectedId]);

  useEffect(() => {
    if (focus) mapRef.current?.animateToRegion({ latitude: focus.latitude, longitude: focus.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 450);
  }, [focus]);

  return (
    <MapView
      initialRegion={{ ...DEFAULT_CENTER, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
      onPress={() => onSelect(null)}
      onRegionChangeComplete={(region) => onCenterChange({ latitude: region.latitude, longitude: region.longitude })}
      provider={PROVIDER_GOOGLE}
      showsMyLocationButton={false}
      showsUserLocation={userLocation !== null}
      ref={mapRef}
      style={StyleSheet.absoluteFill}>
      {pins.map((item) => (
        <Marker
          coordinate={{ latitude: item.latitude, longitude: item.longitude }}
          key={item.id}
          onPress={() => onSelect(item.id)}
          pinColor={item.onDuty ? '#F2B01E' : pinColors[item.kind]}
          title={item.title}
        />
      ))}
    </MapView>
  );
}
