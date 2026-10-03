const base = require('./app.json');

module.exports = () => {
  const nativeKey = process.env.GOOGLE_MAPS_NATIVE_API_KEY;
  const { expo } = base;
  return {
    ...expo,
    ios: { ...expo.ios, config: { ...expo.ios?.config, googleMapsApiKey: nativeKey } },
    android: { ...expo.android, config: { ...expo.android?.config, googleMaps: { apiKey: nativeKey } } },
  };
};
