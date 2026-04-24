import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { utmToLatLon } from '../lib/utils';
import type { Cave } from '../types/cave';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { FilePreview } from '../components/FilePreview';

const MARKER_URL =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';

const INDONESIA_BOUNDS: L.LatLngBoundsExpression = [[-12, 90], [7, 145]];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-[#505050] m-0 mb-1">{label}</p>
      <p className="text-sm text-[#dedede] m-0 leading-snug">{value}</p>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[#1c1c1c]" />;
}

export function CaveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const [cave, setCave] = useState<Cave | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const { data, error } = await supabase
        .from('caves').select('*').eq('id', id).single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const c: Cave = data;
      setCave(c);
      document.title = `Korpala | ${c.name}`;
      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!cave || !mapContainerRef.current || mapRef.current) return;

    const [lat, lon] = utmToLatLon(cave.utm_x, cave.utm_y);

    const map = L.map(mapContainerRef.current, {
      minZoom: 5,
      maxZoom: 14,
      maxBounds: INDONESIA_BOUNDS,
      scrollWheelZoom: false,
    });

    map.fitBounds(INDONESIA_BOUNDS, { padding: [50, 50] });
    map.setView([lat, lon], 12);

    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap contributors',
    }).addTo(map);

    const icon = new L.Icon({
      iconUrl: MARKER_URL,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });

    L.marker([lat, lon], { icon }).addTo(map);

    const container = map.getContainer();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Control') container.classList.add('ctrl-active'); };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Control') container.classList.remove('ctrl-active'); };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        map.scrollWheelZoom.enable();
        clearTimeout((map as never as Record<string, ReturnType<typeof setTimeout>>)._wheelTimeout);
        (map as never as Record<string, ReturnType<typeof setTimeout>>)._wheelTimeout = setTimeout(
          () => map.scrollWheelZoom.disable(), 200
        );
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    mapRef.current = map;

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('wheel', onWheel);
      map.remove();
      mapRef.current = null;
    };
  }, [cave]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#282828] border-t-brand-red rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-[#ededed] flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-5 sm:px-8 py-6 flex flex-col flex-1">
          <Header showBack />
          <div className="flex-1 flex items-center justify-center flex-col gap-3">
            <p className="text-brand-red font-display text-4xl uppercase tracking-tight m-0">404</p>
            <p className="text-[#505050] text-sm m-0">Gua tidak ditemukan</p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  const c = cave!;
  const [lat, lon] = utmToLatLon(c.utm_x, c.utm_y);

  const maxKnownDepth = 1000;
  const depthPct = Math.min(100, Math.round((c.depth_m / maxKnownDepth) * 100));

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#ededed] flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-5 sm:px-8 py-6 flex flex-col flex-1 box-border">
        <Header showBack />

        {/* Hero */}
        <section className="pb-10 pt-2">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="inline-block px-3 py-1 rounded-full border border-[#282828] text-[#808080] text-[11px] font-display uppercase tracking-wider">
              {c.type}
            </span>
            <span className="inline-block px-3 py-1 rounded-full border border-[#282828] text-[#808080] text-[11px] font-display uppercase tracking-wider">
              {c.region}
            </span>
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl uppercase leading-none m-0 tracking-tight text-white font-display"
          >
            {c.name}
          </h1>
          {c.description && (
            <p className="text-[#606060] text-sm leading-relaxed max-w-2xl mt-4 mb-0">
              {c.description}
            </p>
          )}
        </section>

        {/* Content: info card + map */}
        <section className="border-t border-[#1c1c1c] pt-8 mb-10">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Info card */}
            <div className="lg:w-64 xl:w-72 flex-none">
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 flex flex-col gap-5">

                {/* Depth */}
                <div>
                  <p className="text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-[#505050] m-0 mb-2">Kedalaman</p>
                  <p className="text-3xl font-display text-brand-yellow leading-none m-0 mb-2">
                    {c.depth_m}
                    <span className="text-base text-[#505050] ml-1.5">m</span>
                  </p>
                  <div className="h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-red rounded-full transition-all"
                      style={{ width: `${depthPct}%` }}
                    />
                  </div>
                </div>

                <Divider />

                <InfoRow label="Daerah" value={c.region} />
                <InfoRow label="Jenis" value={c.type} />

                <Divider />

                <div>
                  <p className="text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-[#505050] m-0 mb-2">Koordinat UTM</p>
                  <p className="text-xs font-mono text-[#808080] m-0 leading-relaxed">
                    X: {c.utm_x.toLocaleString()}<br />
                    Y: {c.utm_y.toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-[#505050] m-0 mb-2">Lat / Lon</p>
                  <p className="text-xs font-mono text-[#808080] m-0 leading-relaxed">
                    {lat.toFixed(5)}°<br />
                    {lon.toFixed(5)}°
                  </p>
                </div>

                <Divider />

                <div>
                  <p className="text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-[#505050] m-0 mb-1">ID</p>
                  <p className="text-xs font-mono text-[#505050] m-0">{c.id}</p>
                </div>

              </div>
            </div>

            {/* Map */}
            <div className="flex-1 min-h-[360px]">
              <div
                ref={mapContainerRef}
                className="w-full h-full min-h-[360px] rounded-2xl border border-[#1e1e1e] outline-none overflow-hidden shadow-2xl"
              />
            </div>
          </div>
        </section>

        {/* File preview */}
        {c.image_ext && (() => {
          const fileUrl = supabase.storage.from('cave-images').getPublicUrl(`${c.id}.${c.image_ext}`).data.publicUrl;
          return (
            <section className="mb-10">
              <div className="border-t border-[#1c1c1c] pt-8">
                <p className="text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-brand-yellow mb-6">
                  Peta Gua
                </p>
                <FilePreview url={fileUrl} ext={c.image_ext!} />
              </div>
            </section>
          );
        })()}

        <Footer />
      </div>
    </div>
  );
}
