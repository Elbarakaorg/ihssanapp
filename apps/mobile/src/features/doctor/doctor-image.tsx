import { UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, type ImageStyle, type StyleProp, View } from 'react-native';

import { imageUrl } from '@/features/doctor/doctor-api';
import { palette } from '@/ui/palette';

export function RemoteImage({ bucket, path, style, placeholderSize = 28 }: { bucket: string | null; path: string | null; style: StyleProp<ImageStyle>; placeholderSize?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    void imageUrl(bucket, path).then((value) => { if (active) setUrl(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [bucket, path]);
  if (url) return <Image accessibilityIgnoresInvertColors source={{ uri: url }} style={style} resizeMode="cover" />;
  return <View style={[style as object, { alignItems: 'center', backgroundColor: palette.leaf, justifyContent: 'center' }]}><UserRound color={palette.forest} size={placeholderSize} /></View>;
}
