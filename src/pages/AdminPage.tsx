import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuArrowLeft, LuChevronDown, LuTrash2 } from 'react-icons/lu';
import { authClient } from '../lib/auth';
import { getCaves, createCave, updateCave, deleteCave, uploadFile, deleteFile, getImageUrl } from '../lib/api';
import type { Cave } from '../types/cave';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { MapPicker } from '../components/MapPicker';
import { FilePreview } from '../components/FilePreview';
import { useToast } from '../context/ToastContext';

// ─── Error helpers ────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Terjadi kesalahan yang tidak diketahui';
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  'w-full box-border bg-[#0c0c0c] border border-[#282828] rounded-xl px-4 py-2.5 text-[#ededed] text-sm outline-none focus:border-[#444] transition-colors placeholder-[#383838]';

const labelCls =
  'block text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-[#505050] mb-1.5';

function FormField({
  label,
  children,
  fullWidth,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 pt-2 pb-1 border-b border-[#1a1a1a]">
      <p className="text-[10px] md:text-[12px] font-display uppercase tracking-[3px] text-brand-yellow m-0">{children}</p>
    </div>
  );
}

// ─── Login Overlay ────────────────────────────────────────────────────────────

function LoginOverlay({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(getErrorMessage(error) || 'Login gagal');
    } else {
      onLogin();
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] px-4">
      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1 mb-6 text-[#404040] hover:text-[#808080] text-xs font-display uppercase tracking-[2px] transition-colors no-underline"
        >
          <LuArrowLeft className="w-3 h-3" />
          Kembali
        </Link>
        <p className="font-display text-[10px] md:text-[12px] uppercase tracking-[3px] text-brand-red m-0 mb-1">
          Korpala Unhas
        </p>
        <h2 className="font-display text-2xl uppercase tracking-tight text-white m-0 mb-1">
          Akses Admin
        </h2>
        <p className="text-[#505050] text-xs mb-6 m-0">Masukkan kredensial untuk melanjutkan.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          {error && (
            <p className="text-brand-red text-xs m-0 bg-[#1a0c0c] border border-[#3a1515] rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full py-3 bg-brand-red border-2 border-brand-red text-white rounded-xl font-display uppercase tracking-wider text-sm cursor-pointer transition-colors hover:bg-transparent disabled:opacity-50"
          >
            {busy ? 'Memuat...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Add Cave Form ────────────────────────────────────────────────────────────

function AddCaveForm({ onSuccess }: { onSuccess: () => void }) {
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [type, setType] = useState('');
  const [depthM, setDepthM] = useState('');
  const [description, setDescription] = useState('');
  const [utmX, setUtmX] = useState(0);
  const [utmY, setUtmY] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        region: region.trim(),
        type: type.trim(),
        depth_m: Number(depthM) || 0,
        description: description || '',
        utm_x: utmX,
        utm_y: utmY,
      };

      const inserted = await createCave(payload);

      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const filename = `${inserted.id}.${ext}`;
        try {
          await uploadFile(filename, file);
        } catch {
          await deleteCave(inserted.id);
          throw new Error('Upload gagal. Gua tidak disimpan.');
        }
        await updateCave(inserted.id, { image_ext: ext });
      }

      showToast('Gua berhasil ditambahkan');
      onSuccess();
    } catch (err) {
      showToast('Gagal: ' + getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#111] border border-[#1a1a1a] rounded-2xl px-6 py-6">
      <p className="font-display text-xl uppercase tracking-tight text-white m-0 mb-6">Tambah Gua Baru</p>

      <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
        <SectionLabel>Informasi Dasar</SectionLabel>

        <FormField label="Nama">
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} required placeholder="Nama gua" />
        </FormField>
        <FormField label="Daerah">
          <input className={inputCls} value={region} onChange={e => setRegion(e.target.value)} required placeholder="Wilayah geografis" />
        </FormField>
        <FormField label="Jenis">
          <input className={inputCls} value={type} onChange={e => setType(e.target.value)} required placeholder="Jenis gua" />
        </FormField>
        <FormField label="Kedalaman (m)">
          <input type="number" min="0" className={inputCls} value={depthM} onChange={e => setDepthM(e.target.value)} required placeholder="0" />
        </FormField>
        <FormField label="Deskripsi" fullWidth>
          <textarea
            className={inputCls + ' min-h-[90px] resize-y'}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Deskripsi singkat gua..."
          />
        </FormField>

        <SectionLabel>Koordinat</SectionLabel>

        <FormField label="UTM X">
          <input type="number" className={inputCls} value={utmX || ''} onChange={e => setUtmX(Number(e.target.value))} required placeholder="e.g. 523481" />
        </FormField>
        <FormField label="UTM Y">
          <input type="number" className={inputCls} value={utmY || ''} onChange={e => setUtmY(Number(e.target.value))} required placeholder="e.g. 9234219" />
        </FormField>

        <div className="col-span-2 max-sm:col-span-1">
          <MapPicker
            utmX={utmX}
            utmY={utmY}
            onChange={({ utmX: x, utmY: y }) => { setUtmX(x); setUtmY(y); }}
          />
        </div>

        <SectionLabel>Dokumen</SectionLabel>

        <div className="col-span-2 max-sm:col-span-1">
          <label className={labelCls}>File Peta (PNG, JPEG, PDF, HTML)</label>
          <div className="flex items-center gap-2">
            <input
              key={fileKey}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.html"
              className={inputCls + ' flex-1 cursor-pointer file:bg-transparent file:border-0 file:text-[#606060] file:text-xs file:mr-3 file:cursor-pointer'}
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <button
                type="button"
                onClick={() => { setFile(null); setFileKey(k => k + 1); }}
                className="text-sm text-[#606060] hover:text-brand-red transition-colors cursor-pointer bg-transparent border border-[#282828] rounded-lg px-3 py-2.5 whitespace-nowrap"
              >
                ✕ Batal
              </button>
            )}
          </div>
        </div>

        {file && (
          <div className="col-span-2 max-sm:col-span-1">
            <FilePreview file={file} />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full mt-4 py-3 bg-brand-red border-2 border-brand-red text-white rounded-xl font-display uppercase tracking-wider text-sm cursor-pointer transition-colors hover:bg-transparent disabled:opacity-40"
      >
        {busy ? 'Menyimpan...' : 'Simpan Gua'}
      </button>
    </form>
  );
}

// ─── Edit Cave Form ───────────────────────────────────────────────────────────

function EditCaveForm({
  cave,
  onSaved,
  onDeleted,
}: {
  cave: Cave;
  onSaved: (cave: Cave) => void;
  onDeleted: () => void;
}) {
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(cave.name);
  const [region, setRegion] = useState(cave.region);
  const [type, setType] = useState(cave.type);
  const [depthM, setDepthM] = useState(String(cave.depth_m));
  const [description, setDescription] = useState(cave.description ?? '');
  const [utmX, setUtmX] = useState(cave.utm_x);
  const [utmY, setUtmY] = useState(cave.utm_y);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [removeFile, setRemoveFile] = useState(false);
  const existingUrl = cave.image_ext ? getImageUrl(cave.id, cave.image_ext) : null;

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updateObj: Partial<Cave> = {
        name: name.trim(),
        region: region.trim(),
        type: type.trim(),
        depth_m: Number(depthM) || 0,
        description: description || '',
        utm_x: utmX,
        utm_y: utmY,
      };

      if (removeFile && !file && cave.image_ext) {
        await deleteFile(`${cave.id}.${cave.image_ext}`);
        updateObj.image_ext = null;
      }

      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const filename = `${cave.id}.${ext}`;
        try {
          await uploadFile(filename, file);
        } catch {
          throw new Error('Upload gagal. Perubahan tidak disimpan.');
        }
        updateObj.image_ext = ext;
      }

      const updated = await updateCave(cave.id, updateObj);

      setFile(null);
      setRemoveFile(false);
      setFileKey(k => k + 1);

      showToast('Gua berhasil diperbarui');
      onSaved(updated);
    } catch (err) {
      showToast('Gagal: ' + getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  async function handleDelete() {
    if (!confirm(`Hapus "${cave.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setBusy(true);
    try {
      if (cave.image_ext) {
        await deleteFile(`${cave.id}.${cave.image_ext}`);
      }
      await deleteCave(cave.id);
      showToast('Gua berhasil dihapus');
      onDeleted();
    } catch (err) {
      showToast('Gagal: ' + getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#111] border border-[#1a1a1a] rounded-2xl px-6 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-display uppercase tracking-[3px] text-[#505050] m-0 mb-0.5">Editing</p>
          <p className="font-display text-xl uppercase tracking-tight text-white m-0">{cave.name}</p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="flex items-center gap-1.5 text-[#505050] hover:text-brand-red border border-[#282828] hover:border-brand-red/40 rounded-xl px-3 py-2 text-xs font-display uppercase tracking-wider transition-all cursor-pointer bg-transparent disabled:opacity-40"
        >
          <LuTrash2 className="w-3.5 h-3.5" />
          Hapus
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
        <SectionLabel>Informasi Dasar</SectionLabel>

        <FormField label="Nama">
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} required placeholder="Nama gua" />
        </FormField>
        <FormField label="Daerah">
          <input className={inputCls} value={region} onChange={e => setRegion(e.target.value)} required placeholder="Wilayah geografis" />
        </FormField>
        <FormField label="Jenis">
          <input className={inputCls} value={type} onChange={e => setType(e.target.value)} required placeholder="Jenis gua" />
        </FormField>
        <FormField label="Kedalaman (m)">
          <input type="number" min="0" className={inputCls} value={depthM} onChange={e => setDepthM(e.target.value)} required placeholder="0" />
        </FormField>
        <FormField label="Deskripsi" fullWidth>
          <textarea
            className={inputCls + ' min-h-[90px] resize-y'}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Deskripsi singkat gua..."
          />
        </FormField>

        <SectionLabel>Koordinat</SectionLabel>

        <FormField label="UTM X">
          <input type="number" className={inputCls} value={utmX || ''} onChange={e => setUtmX(Number(e.target.value))} required placeholder="e.g. 523481" />
        </FormField>
        <FormField label="UTM Y">
          <input type="number" className={inputCls} value={utmY || ''} onChange={e => setUtmY(Number(e.target.value))} required placeholder="e.g. 9234219" />
        </FormField>

        <div className="col-span-2 max-sm:col-span-1">
          <MapPicker
            utmX={utmX}
            utmY={utmY}
            onChange={({ utmX: x, utmY: y }) => { setUtmX(x); setUtmY(y); }}
          />
        </div>

        <SectionLabel>Dokumen</SectionLabel>

        {/* Existing file preview with remove option */}
        {existingUrl && cave.image_ext && !file && !removeFile && (
          <div className="col-span-2 max-sm:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-display uppercase tracking-[3px] text-[#505050] m-0">File saat ini</p>
              <button
                type="button"
                onClick={() => setRemoveFile(true)}
                className="text-xs text-[#606060] hover:text-brand-red transition-colors cursor-pointer bg-transparent border-0 p-0"
              >
                Hapus file
              </button>
            </div>
            <FilePreview url={existingUrl} ext={cave.image_ext} />
          </div>
        )}

        {removeFile && !file && (
          <div className="col-span-2 max-sm:col-span-1 flex items-center gap-3 text-xs text-[#606060] bg-[#0c0c0c] border border-[#282828] rounded-xl px-4 py-3">
            <span>File akan dihapus saat disimpan.</span>
            <button
              type="button"
              onClick={() => setRemoveFile(false)}
              className="text-brand-yellow hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              Batalkan
            </button>
          </div>
        )}

        {/* File picker */}
        <div className="col-span-2 max-sm:col-span-1">
          <label className={labelCls}>{existingUrl && !removeFile ? 'Ganti File' : 'Upload File'} (PNG, JPEG, PDF, HTML)</label>
          <div className="flex items-center gap-2">
            <input
              key={fileKey}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.html"
              className={inputCls + ' flex-1 cursor-pointer file:bg-transparent file:border-0 file:text-[#606060] file:text-xs file:mr-3 file:cursor-pointer'}
              onChange={e => { setFile(e.target.files?.[0] ?? null); setRemoveFile(false); }}
            />
            {file && (
              <button
                type="button"
                onClick={() => { setFile(null); setFileKey(k => k + 1); }}
                className="text-sm text-[#606060] hover:text-brand-red transition-colors cursor-pointer bg-transparent border border-[#282828] rounded-lg px-3 py-2.5 whitespace-nowrap"
              >
                ✕ Batal
              </button>
            )}
          </div>
        </div>

        {file && (
          <div className="col-span-2 max-sm:col-span-1">
            <FilePreview file={file} />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full mt-4 py-3 bg-brand-red border-2 border-brand-red text-white rounded-xl font-display uppercase tracking-wider text-sm cursor-pointer transition-colors hover:bg-transparent disabled:opacity-40"
      >
        {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
      </button>
    </form>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<'add' | 'edit'>('add');
  const [caves, setCaves] = useState<Cave[]>([]);
  const [selectedCave, setSelectedCave] = useState<Cave | null>(null);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setAuthed(Boolean(data?.session));
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    getCaves().then(setCaves).catch(() => setCaves([]));
  }, [authed]);

  async function loadCaves() {
    setCaves(await getCaves());
  }

  function handleAddSuccess() {
    loadCaves();
  }

  function handleCaveSaved(updated: Cave) {
    setSelectedCave(updated);
    setCaves(cs => cs.map(c => (c.id === updated.id ? updated : c)));
  }

  function handleCaveDeleted() {
    setSelectedCave(null);
    loadCaves();
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#282828] border-t-brand-red rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#ededed] flex flex-col">
      {!authed && <LoginOverlay onLogin={() => setAuthed(true)} />}

      <div className="max-w-4xl mx-auto w-full px-5 sm:px-8 py-6 flex flex-col flex-1 box-border">
        <Header
          showBack
          right={
            authed && (
              <button
                type="button"
                onClick={() => { authClient.signOut(); setAuthed(false); }}
                className="text-[11px] font-display uppercase tracking-[2px] border border-[#282828] text-[#606060] rounded-lg px-4 py-2 transition-all hover:border-brand-red hover:text-brand-red bg-transparent cursor-pointer"
              >
                Sign Out
              </button>
            )
          }
        />

        {/* Page title */}
        <section className="pb-10 pt-2">
          <p className="text-brand-red text-[10px] md:text-[12px] uppercase tracking-[4px] mb-2 font-display m-0">
            Panel Kontrol
          </p>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-white m-0">
            Admin
          </h1>
        </section>

        {/* Tab selector */}
        <div className="border-t border-[#1c1c1c] pt-8 mb-6">
          <div className="inline-flex bg-[#111] border border-[#1a1a1a] rounded-xl p-1 gap-1">
            {(['add', 'edit'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedCave(null);
                }}
                className={[
                  'px-6 py-2.5 rounded-lg text-sm font-display uppercase tracking-wider transition-all cursor-pointer border-0',
                  activeTab === tab
                    ? 'bg-brand-red text-white shadow-sm'
                    : 'text-[#606060] hover:text-[#a0a0a0] bg-transparent',
                ].join(' ')}
              >
                {tab === 'add' ? 'Tambah Gua' : 'Edit Gua'}
              </button>
            ))}
          </div>
        </div>

        {/* Edit: cave selector */}
        {activeTab === 'edit' && (
          <div className="mb-6">
            <label className={labelCls}>Pilih Gua</label>
            <div className="relative">
              <select
                value={selectedCave ? String(selectedCave.id) : ''}
                onChange={e => {
                  const cave = caves.find(c => String(c.id) === e.target.value) ?? null;
                  setSelectedCave(cave);
                }}
                className={inputCls + ' appearance-none pr-9 cursor-pointer'}
              >
                <option value="">— Pilih gua untuk diedit —</option>
                {caves.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} (ID: {c.id})
                  </option>
                ))}
              </select>
              <LuChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#505050] w-4 h-4" />
            </div>
          </div>
        )}

        {/* Forms */}
        {activeTab === 'add' && (
          <AddCaveForm onSuccess={handleAddSuccess} />
        )}

        {activeTab === 'edit' && selectedCave && (
          <EditCaveForm
            key={selectedCave.id}
            cave={selectedCave}
            onSaved={handleCaveSaved}
            onDeleted={handleCaveDeleted}
          />
        )}

        {activeTab === 'edit' && !selectedCave && (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl px-6 py-16 flex items-center justify-center">
            <p className="text-[#383838] text-sm">Pilih gua dari dropdown di atas untuk mulai mengedit</p>
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
}
