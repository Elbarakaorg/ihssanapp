import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Search } from 'lucide-react';

const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const styleUrl = (import.meta.env.VITE_MAPBOX_STYLE_URL as string | undefined) ?? 'mapbox://styles/mapbox/streets-v12';

type Props = { latitude: number | null; longitude: number | null; onChange: (latitude: number, longitude: number) => void };

export default function LocationPicker({ latitude, longitude, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || !container.current) return;
    mapboxgl.accessToken = token;
    const instance = new mapboxgl.Map({
      container: container.current,
      style: styleUrl,
      center: [longitude ?? -7.0, latitude ?? 31.8],
      zoom: latitude === null ? 5 : 15,
      pitch: 0,
      maxPitch: 0,
      dragRotate: false,
    });
    instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    const pin = new mapboxgl.Marker({ draggable: true, color: '#A4502F' });
    if (latitude !== null && longitude !== null) pin.setLngLat([longitude, latitude]).addTo(instance);
    const place = (lng: number, lat: number) => {
      pin.setLngLat([lng, lat]).addTo(instance);
      change.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
    };
    instance.on('click', (event) => place(event.lngLat.lng, event.lngLat.lat));
    pin.on('dragend', () => { const at = pin.getLngLat(); place(at.lng, at.lat); });
    map.current = instance;
    marker.current = pin;
    return () => { instance.remove(); map.current = null; marker.current = null; };
    // The map is created once; coordinates typed into the form are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (latitude === null || longitude === null || !map.current || !marker.current) return;
    const current = marker.current.getLngLat();
    if (Math.abs(current.lat - latitude) < 1e-6 && Math.abs(current.lng - longitude) < 1e-6 && marker.current.getElement().isConnected) return;
    marker.current.setLngLat([longitude, latitude]).addTo(map.current);
    map.current.flyTo({ center: [longitude, latitude], zoom: Math.max(map.current.getZoom(), 15) });
  }, [latitude, longitude]);

  async function search() {
    if (!query.trim() || !token) return;
    setMessage('');
    try {
      const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
      url.search = new URLSearchParams({ q: query.trim(), country: 'ma', limit: '1', access_token: token }).toString();
      const response = await fetch(url);
      const body = (await response.json()) as { features?: { geometry: { coordinates: [number, number] } }[] };
      const hit = body.features?.[0];
      if (!hit) { setMessage('No match. Try a street or neighbourhood, or click the map.'); return; }
      const [lng, lat] = hit.geometry.coordinates;
      change.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
    } catch {
      setMessage('Search is unavailable. Click the map to place the location.');
    }
  }

  if (!token) return <p className="form-help">Set VITE_MAPBOX_TOKEN to place locations on a map. You can still type coordinates.</p>;
  return (
    <div className="picker">
      <div className="form-row">
        <input aria-label="Search for an address" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }} placeholder="Search an address in Morocco" value={query} />
        <button className="button button-secondary" onClick={() => void search()} type="button"><Search size={16} /> Find</button>
      </div>
      {message && <p className="form-help">{message}</p>}
      <div className="picker-map" ref={container} />
      <p className="form-help">Click the map or drag the pin to set the exact entrance.</p>
    </div>
  );
}
