import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LuArrowRight,
  LuChevronUp,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronsLeft,
  LuChevronsRight,
} from 'react-icons/lu';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { utmToLatLon } from '../lib/utils';
import type { Cave } from '../types/cave';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

const MARKER_URL =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';

const INDONESIA_BOUNDS: L.LatLngBoundsExpression = [[-12, 90], [7, 145]];

const COLS = ['id', 'name', 'region', 'type', 'depth_m'] as const;
type SortCol = (typeof COLS)[number];

const COL_LABELS: Record<SortCol, string> = {
  id: 'ID',
  name: 'Nama',
  region: 'Daerah',
  type: 'Jenis',
  depth_m: 'Kedalaman',
};

const PAGE_SIZE = 10;

const inputCls =
  'bg-[#0c0c0c] border border-[#282828] rounded-lg px-3 py-2 text-sm text-[#ededed] placeholder-[#3a3a3a] outline-none focus:border-[#444] transition-colors';

export function HomePage() {
  const mapSectionRef = useRef<HTMLElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  const [caves, setCaves] = useState<Cave[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [depthMin, setDepthMin] = useState<number | ''>('');
  const [depthMax, setDepthMax] = useState<number | ''>('');
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // Map init
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      minZoom: 5,
      maxZoom: 14,
      maxBounds: INDONESIA_BOUNDS,
      scrollWheelZoom: false,
    }).setView([-2.5, 118], 5);

    map.fitBounds(INDONESIA_BOUNDS, { padding: [50, 50] });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

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
      markersRef.current = {};
    };
  }, []);

  // Fetch caves
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('caves').select('*');
      if (error) {
        setFetchError('Terjadi gangguan pada sistem. Silakan coba lagi nanti.');
      } else {
        const list: Cave[] = data ?? [];
        setCaves(list);
        if (mapRef.current) {
          const icon = new L.Icon({
            iconUrl: MARKER_URL,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          });
          list.forEach(cave => {
            const [lat, lon] = utmToLatLon(cave.utm_x, cave.utm_y);
            const popup = `
              <div style="font-family:'Inter',system-ui,sans-serif;">
                <div style="font-family:'Fjalla One',sans-serif;color:rgb(234,2,6);font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px;">${cave.name}</div>
                <div style="color:#909090;font-size:11px;margin-bottom:2px;">${cave.region} · ${cave.type}</div>
                <div style="color:#606060;font-size:11px;margin-bottom:10px;font-family:'JetBrains Mono',monospace;">${cave.depth_m} m</div>
                <a href="/cave/${cave.id}" style="color:rgb(234,2,6);text-decoration:none;font-size:11px;font-family:'Fjalla One',sans-serif;text-transform:uppercase;letter-spacing:1px;">Lihat Detail</a>
              </div>
            `;
            const marker = L.marker([lat, lon], { icon }).addTo(mapRef.current!).bindPopup(popup);
            markersRef.current[cave.id] = marker;
          });
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const regions = [...new Set(caves.map(c => c.region))].filter(Boolean).sort();
  const types = [...new Set(caves.map(c => c.type))].filter(Boolean).sort();

  const filtered = caves.filter(c => {
    if (regionFilter && c.region !== regionFilter) return false;
    if (typeFilter && c.type !== typeFilter) return false;
    const min = depthMin !== '' ? depthMin : -Infinity;
    const max = depthMax !== '' ? depthMax : Infinity;
    if (c.depth_m < min || c.depth_m > max) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        String(c.id).includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        String(c.depth_m).includes(q)
      );
    }
    return true;
  });

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const va = a[sortCol], vb = b[sortCol];
        const cmp = typeof va === 'number' && typeof vb === 'number'
          ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  }

  function handleRowClick(cave: Cave) {
    const [lat, lon] = utmToLatLon(cave.utm_x, cave.utm_y);
    mapRef.current?.flyTo([lat, lon], 12);
    markersRef.current[cave.id]?.openPopup();
    if (mapSectionRef.current) {
      const top = mapSectionRef.current.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  const activeFilterCount = [regionFilter, typeFilter, depthMin !== '', depthMax !== '', search].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#ededed] flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-5 sm:px-8 py-6 flex flex-col flex-1 box-border">
        <Header
          right={
            <Link
              to="/admin"
              className="text-[11px] font-display uppercase tracking-[2px] border border-[#282828] text-[#606060] rounded-lg px-4 py-2 no-underline transition-all hover:border-brand-red hover:text-brand-red"
            >
              Admin
            </Link>
          }
        />

        {/* Hero */}
        <section className="pb-14 pt-4">
          <p
            className="text-brand-red text-[10px] md:text-[12px] uppercase tracking-[4px] mb-3 font-display"
          >
            Korpala Universitas Hasanuddin
          </p>
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl uppercase leading-none m-0 mb-4 tracking-tight text-white font-display"
          >
            Gua Indonesia
          </h1>
          <p className="text-[#707070] text-sm leading-relaxed max-w-lg mb-6">
            Platform eksplorasi dan dokumentasi gua-gua Indonesia untuk peneliti,
            penjelajah, dan masyarakat luas.
          </p>

          {!loading && (
            <div className="flex gap-2.5 flex-wrap">
              {[
                { value: caves.length, label: 'Gua Tercatat' },
                { value: regions.length, label: 'Daerah' }
              ].map(({ value, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 bg-[#141414] border border-[#1e1e1e] rounded-full px-4 py-1.5 text-xs"
                >
                  <span className="text-brand-yellow font-display text-base leading-none">{value}</span>
                  <span className="text-[#606060]">{label}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Description */}
        <section className="border-t border-[#1c1c1c] pt-10 pb-14 grid sm:grid-cols-3 gap-8">
          <p className="text-[#606060] text-sm leading-[1.75] m-0">
            Gua-gua Indonesia menyimpan kekayaan alam, sejarah, dan ekosistem yang luar biasa.
            Melalui proyek pemetaan ini, Korpala Universitas Hasanuddin berupaya mendokumentasikan
            lokasi, karakteristik, dan potensi setiap gua secara akurat dan dapat diakses oleh publik.
          </p>
          <p className="text-[#606060] text-sm leading-[1.75] m-0">
            Peta interaktif ini dibangun untuk mendukung kegiatan eksplorasi, penelitian, keselamatan
            perjalanan, serta pelestarian lingkungan karst di seluruh Nusantara. Dengan menggabungkan
            data lapangan dan teknologi pemetaan, kami berharap platform ini menjadi sumber informasi
            terpercaya bagi semua.
          </p>
          <p className="text-[#606060] text-sm leading-[1.75] m-0">
            Eksplorasi yang bertanggung jawab adalah kunci. Mari bersama menjaga dan melestarikan
            warisan alam Indonesia yang tak ternilai bagi generasi yang akan datang.
          </p>
        </section>

        {/* Map */}
        <section ref={mapSectionRef} className="mb-14">
          <div className="flex items-end justify-between mb-4">
            <span className="text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-brand-yellow">
              Peta Eksplorasi
            </span>
            <span className="text-[#383838] text-xs hidden sm:block">
              Ctrl + scroll untuk zoom
            </span>
          </div>
          <div
            ref={mapContainerRef}
            className="h-[460px] sm:h-[540px] w-full rounded-2xl border border-[#1e1e1e] outline-none overflow-hidden shadow-2xl"
          />
          <p className="text-[#353535] text-[11px] mt-3 text-center">
            Klik baris pada tabel untuk mengarahkan peta ke lokasi gua
          </p>
        </section>

        {/* Database */}
        <section className="mb-6">
          <div className="flex items-end justify-between mb-6">
            <span className="text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-brand-yellow">
              Database Gua
            </span>
          </div>

          {/* Filters */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[150px]">
                <p className="text-[10px] md:text-[12px] font-display uppercase tracking-widest text-[#444] mb-1.5 m-0">Cari</p>
                <input
                  type="text"
                  placeholder="Nama, daerah, jenis..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className={inputCls + ' w-full'}
                />
              </div>
              {!search && (
                <>
                  <div>
                    <p className="text-[10px] md:text-[12px] font-display uppercase tracking-widest text-[#444] mb-1.5 m-0">Daerah</p>
                    <select
                      value={regionFilter}
                      onChange={e => { setRegionFilter(e.target.value); setPage(1); }}
                      className={inputCls}
                    >
                      <option value="">Semua</option>
                      {regions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[12px] font-display uppercase tracking-widest text-[#444] mb-1.5 m-0">Jenis</p>
                    <select
                      value={typeFilter}
                      onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                      className={inputCls}
                    >
                      <option value="">Semua</option>
                      {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[12px] font-display uppercase tracking-widest text-[#444] mb-1.5 m-0">Kedalaman (m)</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Min"
                        value={depthMin}
                        onChange={e => { setDepthMin(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
                        className={inputCls + ' w-[72px]'}
                      />
                      <span className="text-[#383838] text-sm">–</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Max"
                        value={depthMax}
                        onChange={e => { setDepthMax(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
                        className={inputCls + ' w-[72px]'}
                      />
                    </div>
                  </div>
                </>
              )}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setSearch(''); setRegionFilter(''); setTypeFilter('');
                    setDepthMin(''); setDepthMax(''); setPage(1);
                  }}
                  className="text-[#606060] hover:text-brand-red text-sm border border-[#282828] rounded-lg px-3 py-2 transition-colors bg-transparent cursor-pointer whitespace-nowrap"
                >
                  Reset ({activeFilterCount})
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-5 h-5 border-2 border-[#282828] border-t-brand-red rounded-full animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="text-center py-24 text-[#505050] text-sm">{fetchError}</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-[#1a1a1a]">
                <table className="w-full border-collapse" style={{ minWidth: '580px' }}>
                  <thead>
                    <tr className="bg-[#111]">
                      {COLS.map(col => (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          className="px-4 py-3 text-left text-[10px] md:text-[12px] text-[#444] font-display uppercase tracking-widest cursor-pointer select-none whitespace-nowrap border-b border-[#1a1a1a] hover:text-[#707070] transition-colors"
                        >
                          {COL_LABELS[col]}
                          {sortCol === col && (
                            sortDir === 'asc'
                              ? <LuChevronUp className="inline ml-1 w-3 h-3 text-brand-yellow" />
                              : <LuChevronDown className="inline ml-1 w-3 h-3 text-brand-yellow" />
                          )}
                        </th>
                      ))}
                      <th className="px-4 py-3 border-b border-[#1a1a1a] w-8" />
                    </tr>
                  </thead>
                  <tbody className="bg-[#0c0c0c]">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-20 text-[#404040] text-sm">
                          {caves.length === 0 ? 'Belum ada data gua' : 'Tidak ada gua yang sesuai filter'}
                        </td>
                      </tr>
                    ) : (
                      paginated.map(cave => (
                        <tr
                          key={cave.id}
                          onClick={() => handleRowClick(cave)}
                          className="border-b border-[#161616] hover:bg-[#111] cursor-pointer group transition-colors last:border-0"
                        >
                          <td className="px-4 py-3.5 text-xs text-[#404040] font-mono">{cave.id}</td>
                          <td className="px-4 py-3.5 text-sm text-[#dedede] font-medium">{cave.name}</td>
                          <td className="px-4 py-3.5 text-sm text-[#808080]">{cave.region}</td>
                          <td className="px-4 py-3.5 text-sm text-[#808080]">{cave.type}</td>
                          <td className="px-4 py-3.5 font-mono text-sm">
                            <span className="text-brand-yellow">{cave.depth_m}</span>
                            <span className="text-[#404040] text-xs ml-1">m</span>
                          </td>
                          <td className="px-4 py-3.5 text-[#282828] group-hover:text-[#606060] transition-colors">
                            <LuArrowRight className="w-4 h-4" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {sorted.length > 0 && (
                <div className="flex justify-between items-center mt-4 flex-wrap gap-2">
                  <span className="text-[#404040] text-xs">
                    {`${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, sorted.length)} dari ${sorted.length} gua`}
                  </span>
                  <div className="flex gap-0.5">
                    {[
                      { icon: <LuChevronsLeft className="w-4 h-4" />, target: 1, disabled: safePage <= 1 },
                      { icon: <LuChevronLeft className="w-4 h-4" />, target: safePage - 1, disabled: safePage <= 1 },
                      { icon: <LuChevronRight className="w-4 h-4" />, target: safePage + 1, disabled: safePage >= totalPages },
                      { icon: <LuChevronsRight className="w-4 h-4" />, target: totalPages, disabled: safePage >= totalPages },
                    ].map(({ icon, target, disabled }, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(target)}
                        disabled={disabled}
                        className="w-8 h-8 flex items-center justify-center text-[#505050] disabled:text-[#252525] hover:text-brand-yellow transition-colors bg-transparent border-0 cursor-pointer disabled:cursor-default"
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <Footer />
      </div>
    </div>
  );
}
