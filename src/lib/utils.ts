import proj4 from 'proj4';

export const UTM51S = '+proj=utm +zone=51 +south +datum=WGS84 +units=m +no_defs';
export const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

export function utmToLatLon(utm_x: number, utm_y: number): [number, number] {
  const [lon, lat] = proj4(UTM51S, WGS84, [utm_x, utm_y]);
  return [lat, lon];
}

export function latLonToUtm(lat: number, lon: number): [number, number] {
  const [utm_x, utm_y] = proj4(WGS84, UTM51S, [lon, lat]);
  return [utm_x, utm_y];
}

