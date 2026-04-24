import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { utmToLatLon, latLonToUtm } from '../lib/utils';

const RED_ICON_URL =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';

const INDONESIA_BOUNDS: L.LatLngBoundsExpression = [
  [-12, 90],
  [7, 145],
];

interface MapPickerProps {
  utmX: number;
  utmY: number;
  onChange: (coords: { utmX: number; utmY: number }) => void;
}

export function MapPicker({ utmX, utmY, onChange }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const hasCoords = utmX && utmY && !isNaN(utmX) && !isNaN(utmY);
    const [defaultLat, defaultLon] = hasCoords ? utmToLatLon(utmX, utmY) : [-2.5, 118];
    const defaultZoom = hasCoords ? 12 : 5;

    const map = L.map(containerRef.current, {
      minZoom: 5,
      maxZoom: 14,
      maxBounds: INDONESIA_BOUNDS,
      scrollWheelZoom: false,
    }).setView([defaultLat, defaultLon], defaultZoom);

    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap contributors',
    }).addTo(map);

    const redIcon = new L.Icon({
      iconUrl: RED_ICON_URL,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });

    const marker = L.marker([defaultLat, defaultLon], {
      icon: redIcon,
      draggable: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const latlng = marker.getLatLng();
      const [x, y] = latLonToUtm(latlng.lat, latlng.lng);
      onChange({ utmX: Math.round(x), utmY: Math.round(y) });
    });

    const container = map.getContainer();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') container.classList.add('ctrl-active');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') container.classList.remove('ctrl-active');
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        map.scrollWheelZoom.enable();
        clearTimeout((map as never as Record<string, ReturnType<typeof setTimeout>>)._wheelTimeout);
        (map as never as Record<string, ReturnType<typeof setTimeout>>)._wheelTimeout = setTimeout(
          () => map.scrollWheelZoom.disable(),
          200
        );
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('wheel', onWheel);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker when UTM props change (from text input)
  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    if (!utmX || !utmY || isNaN(utmX) || isNaN(utmY)) return;
    const [lat, lon] = utmToLatLon(utmX, utmY);
    markerRef.current.setLatLng([lat, lon]);
    mapRef.current.setView([lat, lon], mapRef.current.getZoom());
  }, [utmX, utmY]);

  return (
    <div
      ref={containerRef}
      className="h-[380px] w-full rounded-xl overflow-hidden border border-[#1e1e1e]"
      style={{ gridColumn: '1 / -1' }}
    />
  );
}
