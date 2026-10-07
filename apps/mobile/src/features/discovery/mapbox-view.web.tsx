import { useEffect, useMemo, useRef, useState } from 'react';

import { mapFrameUrl, parseMapEvent, type MapCommand } from './map-runtime';
import type { MapboxViewProps } from './mapbox-types';

export default function MapboxView({ token, styleUrl, theme, pins, user, mode, fly, selectedId, onEvent }: MapboxViewProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const src = useMemo(() => mapFrameUrl({ token, styleUrl, theme }), [token, styleUrl, theme]);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => { setReady(false); }, [src]);

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const parsed = parseMapEvent(event.data?.ihssanMap);
      if (!parsed) return;
      if (parsed.type === 'ready') setReady(true);
      handler.current(parsed);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  const send = (command: MapCommand) => frame.current?.contentWindow?.postMessage({ ihssanIn: command }, '*');

  useEffect(() => { if (ready) send({ type: 'mode', mode }); }, [ready, mode]);
  useEffect(() => { if (ready) send({ type: 'user', position: user }); }, [ready, user]);
  useEffect(() => { if (ready) send({ type: 'pins', pins }); }, [ready, pins]);
  useEffect(() => { if (ready && fly) send({ type: 'fly', lat: fly.lat, lng: fly.lng, zoom: fly.zoom }); }, [ready, fly]);
  useEffect(() => { if (ready) send({ type: 'select', id: selectedId }); }, [ready, selectedId]);

  return (
    <iframe
      ref={frame}
      sandbox="allow-scripts allow-same-origin"
      src={src}
      style={{ border: 0, height: '100%', position: 'absolute', width: '100%' }}
      title="Care map"
    />
  );
}
