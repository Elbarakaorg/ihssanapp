import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { buildMapHtml, parseMapEvent, type MapCommand } from './map-runtime';
import type { MapboxViewProps } from './mapbox-types';

export default function MapboxView({ token, styleUrl, theme, pins, user, mode, fly, selectedId, onEvent }: MapboxViewProps) {
  const webview = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildMapHtml({ token, styleUrl, theme }), [token, styleUrl, theme]);

  useEffect(() => { setReady(false); }, [html]);

  const send = (command: MapCommand) => webview.current?.injectJavaScript(`window.__fromApp(${JSON.stringify(command)});true;`);

  useEffect(() => { if (ready) send({ type: 'mode', mode }); }, [ready, mode]);
  useEffect(() => { if (ready) send({ type: 'user', position: user }); }, [ready, user]);
  useEffect(() => { if (ready) send({ type: 'pins', pins }); }, [ready, pins]);
  useEffect(() => { if (ready && fly) send({ type: 'fly', lat: fly.lat, lng: fly.lng, zoom: fly.zoom }); }, [ready, fly]);
  useEffect(() => { if (ready) send({ type: 'select', id: selectedId }); }, [ready, selectedId]);

  const onMessage = (event: WebViewMessageEvent) => {
    const parsed = parseMapEvent(event.nativeEvent.data);
    if (!parsed) return;
    if (parsed.type === 'ready') setReady(true);
    onEvent(parsed);
  };

  return (
    <WebView
      allowsInlineMediaPlayback
      bounces={false}
      javaScriptEnabled
      onMessage={onMessage}
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('https://localhost/') || request.url.startsWith('data:') || request.url.startsWith('https://api.mapbox.com/')}
      originWhitelist={['*']}
      ref={webview}
      scrollEnabled={false}
      setSupportMultipleWindows={false}
      source={{ html, baseUrl: 'https://localhost/' }}
      style={StyleSheet.absoluteFill}
    />
  );
}
