import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, ZoomIn, RefreshCw, Loader2, X, ChevronDown, Sparkles, MapPin, Image, Map, Zap } from 'lucide-react';
import { AutoVideoBlueprintV2, AutoVideoSceneV2, AutoVideoPipItemV2, AutoVideoPipSource, PipAnimDirection } from '../utils/aiClient';
import { generateImageFromCloudflare } from '../utils/cloudflareClient';
import { useEditorStore } from '../store/editorStore';

// ---------------------------------------------------------------------------
// Global sequential queue to avoid Cloudflare API rate-limit bursts
// ---------------------------------------------------------------------------
let cfQueue: Promise<void> = Promise.resolve();

// ---------------------------------------------------------------------------
// OSM Static Map URL builder (no API key, free, works everywhere)
// Renders via the standard OSM tile server + a simple marker overlay.
// ---------------------------------------------------------------------------
function buildOsmStaticUrl(
  lat: number,
  lng: number,
  zoom: number,
  style: string,
  width = 320,
  height = 200
): string {
  // Use opentopomap for vintage, standard OSM otherwise
  // We'll embed an OSM iframe or a tile image
  // Best approach: use staticmap API via maps.geoapify.com or use a direct tile
  // Using openstreetmap.org tile directly (single tile at zoom+tileX+tileY)
  // For a preview we use a simple URL with a marker
  const tileStyle: Record<string, string> = {
    standard: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    dark: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png',
    vintage: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };
  // Build a geoapify static map URL (generous free tier, no registration for low res)
  const styleParam = style === 'dark' ? 'dark-matter' : style === 'satellite' ? 'imagery' : style === 'vintage' ? 'toner' : 'osm-bright';
  return `https://maps.geoapify.com/v1/staticmap?style=${styleParam}&width=${width}&height=${height}&center=lonlat:${lng},${lat}&zoom=${zoom}&marker=lonlat:${lng},${lat};color:%23ef4444;size:medium&apiKey=4a77f7f3f3ee434183de843e5d94e0b4`;
}

// ---------------------------------------------------------------------------
// MapTile — renders an OpenStreetMap static preview for a map pip
// ---------------------------------------------------------------------------
interface MapTileProps {
  pip: AutoVideoPipItemV2;
  onPreview: () => void;
  onDelete?: () => void;
  onEdit: () => void;
  width?: string;
  height?: string;
}

function MapTile({ pip, onPreview, onDelete, onEdit, width = 'w-32', height = 'h-20' }: MapTileProps) {
  const waypoint = pip.mapWaypoints?.[0];
  const lat = waypoint?.lat ?? 0;
  const lng = waypoint?.lng ?? 0;
  const zoom = pip.mapZoom ?? 8;
  const style = pip.mapStyle ?? 'standard';
  const [imgError, setImgError] = useState(false);

  const mapUrl = buildOsmStaticUrl(lat, lng, zoom, style);

  return (
    <div className={`relative shrink-0 rounded-lg overflow-hidden border border-indigo-800/40 group cursor-pointer ${width} ${height} bg-[#0a1628]`}>
      {/* Map preview image */}
      {!imgError ? (
        <img
          src={mapUrl}
          alt="Map Preview"
          className="w-full h-full object-cover opacity-90"
          onError={() => setImgError(true)}
          onClick={onEdit}
        />
      ) : (
        /* Fallback: stylised map placeholder */
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-[#0f2a4a] to-[#1a3a6a]"
          onClick={onEdit}
        >
          <Map className="w-5 h-5 text-blue-400" />
          <span className="text-[8px] text-blue-300 text-center px-1 leading-tight">{pip.prompt}</span>
        </div>
      )}

      {/* Map badge */}
      <div className="absolute top-1 left-1 bg-blue-600/90 rounded px-1 py-0.5 flex items-center gap-0.5">
        <MapPin className="w-2 h-2 text-white" />
        <span className="text-[8px] text-white font-bold">MAP</span>
      </div>

      {/* Hover overlay */}
      <div
        className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-1.5"
        onClick={onEdit}
      >
        <div className="bg-white/20 backdrop-blur-sm rounded px-1.5 py-0.5 text-[8px] text-white">Edit</div>
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-1 right-1 p-0.5 bg-red-500/80 hover:bg-red-600 rounded transition-opacity opacity-0 group-hover:opacity-100 z-10"
          title="Delete"
        >
          <Trash2 className="w-2.5 h-2.5 text-white" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageTile — auto-generates from Cloudflare, re-generates when prompt changes
// ---------------------------------------------------------------------------
interface ImageTileProps {
  prompt: string;
  resolvedUrl?: string;
  settings: any;
  onPreview: (url: string | null) => void;
  onDelete?: () => void;
  onUrlResolved?: (url: string) => void;
  width?: string;
  height?: string;
}

function ImageTile({ prompt, resolvedUrl, settings, onPreview, onDelete, onUrlResolved, width = 'w-32', height = 'h-20' }: ImageTileProps) {
  const [url, setUrl] = useState<string | null>(resolvedUrl ?? null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const lastPromptRef = useRef<string>('');
  const cancelledRef = useRef(false);

  const generate = useCallback(async () => {
    const accountId = settings?.cloudflareAccountId || import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;
    const apiToken = settings?.cloudflareApiToken || import.meta.env.VITE_CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken || !prompt) return;

    cancelledRef.current = false;
    setStatus('loading');
    setUrl(null);

    const myTurn = cfQueue.then(async () => {
      if (cancelledRef.current) return;
      try {
        await new Promise(r => setTimeout(r, 600));
        if (cancelledRef.current) return;
        const result = await generateImageFromCloudflare(prompt, accountId, apiToken);
        if (cancelledRef.current) return;
        setUrl(result);
        setStatus('idle');
        onUrlResolved?.(result);
      } catch (e) {
        if (!cancelledRef.current) setStatus('error');
      }
    });
    cfQueue = myTurn.catch(() => {});
  }, [prompt, settings, onUrlResolved]);

  useEffect(() => {
    if (prompt !== lastPromptRef.current) {
      lastPromptRef.current = prompt;
      if (resolvedUrl) {
        setUrl(resolvedUrl);
        setStatus('idle');
      } else {
        generate();
      }
    }
    return () => { cancelledRef.current = true; };
  }, [prompt, resolvedUrl]);

  return (
    <div className={`relative shrink-0 rounded-lg overflow-hidden bg-[#111] border border-[#2a2a2a] group cursor-pointer ${width} ${height}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#111]">
          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          <span className="text-[9px] text-[#6a6a6a] text-center px-1">Generating...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 bg-[#111]">
          <span className="text-[9px] text-red-400 text-center">Failed</span>
          <button
            onClick={(e) => { e.stopPropagation(); generate(); }}
            className="text-[9px] text-indigo-400 hover:text-indigo-300 underline"
          >
            Retry
          </button>
        </div>
      )}
      {url && (
        <img
          src={url}
          alt="Generated"
          className="w-full h-full object-cover"
          onClick={() => onPreview(url)}
        />
      )}
      {url && (
        <div
          className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
          onClick={() => onPreview(url)}
        >
          <ZoomIn className="w-4 h-4 text-white" />
        </div>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-1 right-1 p-0.5 bg-red-500/80 hover:bg-red-600 rounded transition-opacity opacity-0 group-hover:opacity-100 z-10"
          title="Delete"
        >
          <Trash2 className="w-2.5 h-2.5 text-white" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Preview Modal with editable prompt
// ---------------------------------------------------------------------------
interface PreviewModalProps {
  prompt: string;
  url: string | null;
  onClose: () => void;
  onPromptChange: (newPrompt: string) => void;
}

function ImagePreviewModal({ prompt, url, onClose, onPromptChange }: PreviewModalProps) {
  const [editPrompt, setEditPrompt] = useState(prompt);
  const changed = editPrompt.trim() !== prompt.trim();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl max-w-xl w-full p-5 flex flex-col gap-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-indigo-400" /> Image Preview
          </span>
          <button onClick={onClose} className="text-[#6a6a6a] hover:text-white rounded p-1 hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="w-full aspect-video rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
          {url ? (
            <img src={url} alt="Preview" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              <span className="text-xs text-[#6a6a6a]">Generating image...</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider">
            Image Prompt — edit and apply to regenerate
          </label>
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            className="w-full h-20 bg-[#0e0e0e] border border-[#2a2a2a] focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none resize-none"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-[#8a8a8a] hover:text-white border border-[#2a2a2a] rounded-lg transition-colors">
            Close
          </button>
          <button
            onClick={() => { if (changed) { onPromptChange(editPrompt.trim()); onClose(); } }}
            disabled={!changed}
            className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Apply & Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MapEditModal — edit waypoints, zoom, style for a map pip
// ---------------------------------------------------------------------------
interface MapEditModalProps {
  pip: AutoVideoPipItemV2;
  onClose: () => void;
  onSave: (updated: AutoVideoPipItemV2) => void;
}

function MapEditModal({ pip, onClose, onSave }: MapEditModalProps) {
  const [location, setLocation] = useState(pip.prompt);
  const [lat, setLat] = useState(String(pip.mapWaypoints?.[0]?.lat ?? 0));
  const [lng, setLng] = useState(String(pip.mapWaypoints?.[0]?.lng ?? 0));
  const [label, setLabel] = useState(pip.mapWaypoints?.[0]?.label ?? '');
  const [zoom, setZoom] = useState(pip.mapZoom ?? 8);
  const [style, setStyle] = useState<'standard' | 'satellite' | 'dark' | 'vintage'>(pip.mapStyle ?? 'standard');
  const [animType, setAnimType] = useState<'route' | 'flyTo' | 'highlight'>(pip.mapAnimType ?? 'flyTo');
  const [previewError, setPreviewError] = useState(false);

  const latNum = parseFloat(lat) || 0;
  const lngNum = parseFloat(lng) || 0;
  const previewUrl = buildOsmStaticUrl(latNum, lngNum, zoom, style, 400, 220);

  const handleSave = () => {
    onSave({
      ...pip,
      prompt: location,
      mapWaypoints: [{ lat: latNum, lng: lngNum, label: label || location }],
      mapZoom: zoom,
      mapStyle: style,
      mapAnimType: animType,
      resolvedUrl: undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl max-w-lg w-full p-5 flex flex-col gap-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <Map className="w-4 h-4 text-blue-400" /> Configure Map Animation
          </span>
          <button onClick={onClose} className="text-[#6a6a6a] hover:text-white rounded p-1 hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map preview */}
        <div className="w-full rounded-xl overflow-hidden bg-[#0a1628] border border-blue-900/30" style={{ height: 160 }}>
          {!previewError ? (
            <img
              src={previewUrl}
              alt="Map preview"
              className="w-full h-full object-cover"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Map className="w-8 h-8 text-blue-500" />
              <span className="text-xs text-blue-400">Map preview</span>
              <span className="text-[10px] text-[#5a5a5a]">{lat}, {lng} · zoom {zoom}</span>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider">Location Name</label>
            <input
              value={location}
              onChange={(e) => { setLocation(e.target.value); setLabel(e.target.value); setPreviewError(false); }}
              placeholder="e.g. Cairo, Egypt"
              className="bg-[#0e0e0e] border border-[#2a2a2a] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider">Latitude</label>
            <input
              value={lat}
              onChange={(e) => { setLat(e.target.value); setPreviewError(false); }}
              placeholder="e.g. 30.0444"
              className="bg-[#0e0e0e] border border-[#2a2a2a] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider">Longitude</label>
            <input
              value={lng}
              onChange={(e) => { setLng(e.target.value); setPreviewError(false); }}
              placeholder="e.g. 31.2357"
              className="bg-[#0e0e0e] border border-[#2a2a2a] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider">Zoom (1–18)</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={1} max={18} value={zoom}
                onChange={(e) => { setZoom(parseInt(e.target.value)); setPreviewError(false); }}
                className="flex-1 h-1 accent-blue-500"
              />
              <span className="text-[10px] text-white w-4">{zoom}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider">Animation</label>
            <select
              value={animType}
              onChange={(e) => setAnimType(e.target.value as any)}
              className="bg-[#0e0e0e] border border-[#2a2a2a] focus:border-blue-500 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
            >
              <option value="flyTo">Fly To</option>
              <option value="route">Route</option>
              <option value="highlight">Highlight</option>
            </select>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider">Map Style</label>
            <div className="flex gap-2">
              {(['standard', 'dark', 'satellite', 'vintage'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStyle(s); setPreviewError(false); }}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors border ${
                    style === s
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-[#111] border-[#2a2a2a] text-[#8a8a8a] hover:border-blue-600 hover:text-white'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-[#8a8a8a] hover:text-white border border-[#2a2a2a] rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <MapPin className="w-3 h-3" /> Save Map
          </button>
        </div>
      </div>
    </div>
  );
}

// Animation direction options for the override dropdown
const ANIM_DIRECTIONS: { value: PipAnimDirection; label: string }[] = [
  { value: 'floatUp',      label: '↑ Float Up' },
  { value: 'floatDown',    label: '↓ Float Down' },
  { value: 'slideInLeft',  label: '← Slide Left' },
  { value: 'slideInRight', label: '→ Slide Right' },
  { value: 'zoomIn',       label: '⊕ Zoom In' },
  { value: 'zoomOut',      label: '⊖ Zoom Out' },
  { value: 'kenBurns',     label: '⟳ Ken Burns' },
  { value: 'pop',          label: '✦ Pop' },
  { value: 'drift',        label: '~ Drift' },
  { value: 'rotate',       label: '↻ Rotate' },
  { value: 'none',         label: '— None' },
];

// ---------------------------------------------------------------------------
// PipTile — wraps ImageTile or MapTile based on pip.source + source toggle
// ---------------------------------------------------------------------------
interface PipTileProps {
  pip: AutoVideoPipItemV2;
  sceneIdx: number;
  pipIdx: number;
  settings: any;
  disabled?: boolean;
  onDelete?: () => void;
  onUpdatePip: (updated: AutoVideoPipItemV2) => void;
  onPreviewImage: (url: string | null, prompt: string, onPromptChange: (p: string) => void) => void;
  onEditMap: (pip: AutoVideoPipItemV2, onSave: (updated: AutoVideoPipItemV2) => void) => void;
}

function PipTile({ pip, settings, disabled, onDelete, onUpdatePip, onPreviewImage, onEditMap }: PipTileProps) {
  const isMap = pip.source === 'map';
  const animDir = pip.animDirection ?? 'floatUp';

  const switchSource = (newSource: AutoVideoPipSource) => {
    if (newSource === pip.source) return;
    if (newSource === 'map') {
      onUpdatePip({
        ...pip,
        source: 'map',
        resolvedUrl: undefined,
        mapWaypoints: pip.mapWaypoints ?? [{ lat: 0, lng: 0, label: pip.prompt }],
        mapZoom: pip.mapZoom ?? 8,
        mapStyle: pip.mapStyle ?? 'standard',
        mapAnimType: pip.mapAnimType ?? 'flyTo',
      });
    } else {
      onUpdatePip({
        ...pip,
        source: 'ai_image',
        resolvedUrl: undefined,
        mapWaypoints: undefined,
        mapZoom: undefined,
        mapStyle: undefined,
        mapAnimType: undefined,
      });
    }
  };

  const setAnimDir = (dir: PipAnimDirection) => {
    onUpdatePip({ ...pip, animDirection: dir });
  };

  return (
    <div className="flex flex-col gap-1 shrink-0">
      {/* Source toggle pill */}
      <div className="flex rounded-md overflow-hidden border border-[#2a2a2a] h-5">
        <button
          onClick={() => switchSource('ai_image')}
          disabled={disabled}
          className={`flex-1 flex items-center justify-center gap-0.5 text-[8px] font-medium transition-colors px-1 ${
            !isMap ? 'bg-indigo-700 text-white' : 'bg-[#1a1a1a] text-[#6a6a6a] hover:text-white'
          }`}
          title="Switch to AI Image"
        >
          <Image className="w-2 h-2" /> AI
        </button>
        <button
          onClick={() => switchSource('map')}
          disabled={disabled}
          className={`flex-1 flex items-center justify-center gap-0.5 text-[8px] font-medium transition-colors px-1 ${
            isMap ? 'bg-blue-700 text-white' : 'bg-[#1a1a1a] text-[#6a6a6a] hover:text-white'
          }`}
          title="Switch to Map Animation"
        >
          <MapPin className="w-2 h-2" /> Map
        </button>
      </div>

      {/* Tile */}
      {isMap ? (
        <MapTile
          pip={pip}
          onPreview={() => onEditMap(pip, onUpdatePip)}
          onDelete={onDelete}
          onEdit={() => onEditMap(pip, onUpdatePip)}
        />
      ) : (
        <ImageTile
          prompt={pip.prompt}
          resolvedUrl={pip.resolvedUrl}
          settings={settings}
          onPreview={(url) => onPreviewImage(url, pip.prompt, (p) => onUpdatePip({ ...pip, prompt: p, resolvedUrl: undefined }))}
          onDelete={onDelete}
          onUrlResolved={(url) => onUpdatePip({ ...pip, resolvedUrl: url })}
        />
      )}

      {/* Animation direction badge + override (AI images only) */}
      {!isMap && (
        <div className="relative">
          <select
            value={animDir}
            onChange={(e) => setAnimDir(e.target.value as PipAnimDirection)}
            disabled={disabled}
            title="Animation Direction"
            className="w-full appearance-none bg-[#111] border border-[#2a2a2a] hover:border-indigo-600/60 rounded-md pl-4 pr-1 py-0.5 text-[8px] text-indigo-300 outline-none cursor-pointer disabled:opacity-50 transition-colors"
          >
            {ANIM_DIRECTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Zap className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 text-indigo-500 pointer-events-none" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutoVoxBlueprintView — Main exported component
// ---------------------------------------------------------------------------
export interface AutoVoxBlueprintViewProps {
  blueprint: AutoVideoBlueprintV2;
  onChange: (updated: AutoVideoBlueprintV2) => void;
  disabled?: boolean;
}

export function AutoVoxBlueprintView({ blueprint, onChange, disabled }: AutoVoxBlueprintViewProps) {
  const settings = useEditorStore((s) => s.settings) as any;

  // Preview modal state
  const [previewModal, setPreviewModal] = useState<{
    url: string | null;
    prompt: string;
    onPromptChange: (p: string) => void;
  } | null>(null);

  // Map edit modal state
  const [mapEditModal, setMapEditModal] = useState<{
    pip: AutoVideoPipItemV2;
    onSave: (updated: AutoVideoPipItemV2) => void;
  } | null>(null);

  // ── Backgrounds helpers ──────────────────────────────────────────────────

  const updateBgPrompt = (bgIdx: number, newPrompt: string) => {
    const newBgs = blueprint.globalBackgrounds.map((bg, i) =>
      i === bgIdx ? { prompt: newPrompt, resolvedUrl: undefined } : bg
    );
    onChange({ ...blueprint, globalBackgrounds: newBgs });
  };

  const setBgUrl = (bgIdx: number, url: string) => {
    const newBgs = blueprint.globalBackgrounds.map((bg, i) =>
      i === bgIdx ? { ...bg, resolvedUrl: url } : bg
    );
    onChange({ ...blueprint, globalBackgrounds: newBgs });
  };

  const deleteBg = (bgIdx: number) => {
    if (blueprint.globalBackgrounds.length <= 1) return;
    const newBgs = blueprint.globalBackgrounds.filter((_, i) => i !== bgIdx);
    const newScenes = blueprint.scenes.map((s) => ({
      ...s,
      selectedBackgroundIndex: Math.min(s.selectedBackgroundIndex, newBgs.length - 1)
    }));
    onChange({ ...blueprint, globalBackgrounds: newBgs, scenes: newScenes });
  };

  const addBackground = () => {
    const newBg = { prompt: `cinematic backdrop related to: ${blueprint.storyTheme}` };
    onChange({ ...blueprint, globalBackgrounds: [...blueprint.globalBackgrounds, newBg] });
  };

  // ── Scene/PIP helpers ────────────────────────────────────────────────────

  const updateSceneBg = (sceneIdx: number, bgIdx: number) => {
    const newScenes = blueprint.scenes.map((s, i) =>
      i === sceneIdx ? { ...s, selectedBackgroundIndex: bgIdx } : s
    );
    onChange({ ...blueprint, scenes: newScenes });
  };

  const updatePip = (sceneIdx: number, pipIdx: number, updated: AutoVideoPipItemV2) => {
    const newScenes = blueprint.scenes.map((s, i) => {
      if (i !== sceneIdx) return s;
      const newPips = s.pipItems.map((p, j) => j === pipIdx ? updated : p);
      return { ...s, pipItems: newPips };
    });
    onChange({ ...blueprint, scenes: newScenes });
  };

  const deletePip = (sceneIdx: number, pipIdx: number) => {
    const newScenes = blueprint.scenes.map((s, i) => {
      if (i !== sceneIdx) return s;
      return { ...s, pipItems: s.pipItems.filter((_, j) => j !== pipIdx) };
    });
    onChange({ ...blueprint, scenes: newScenes });
  };

  const addPip = (sceneIdx: number) => {
    const scene = blueprint.scenes[sceneIdx];
    const newPip: AutoVideoPipItemV2 = {
      source: 'ai_image',
      prompt: `${scene.narration} — foreground element, isolated on #00FF00 green screen`
    };
    const newScenes = blueprint.scenes.map((s, i) =>
      i === sceneIdx ? { ...s, pipItems: [...s.pipItems, newPip] } : s
    );
    onChange({ ...blueprint, scenes: newScenes });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* ── Story Theme ─────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-900/30 to-violet-900/20 border border-indigo-700/30 rounded-xl p-3.5 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Story Theme</div>
          <div className="text-xs text-white/90 leading-snug">{blueprint.storyTheme}</div>
        </div>
      </div>

      {/* ── Global Backgrounds ──────────────────────────── */}
      <div className="bg-[#181818] border border-[#252525] rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[9px] font-bold text-[#7a7a7a] uppercase tracking-widest">
            Global Backgrounds ({blueprint.globalBackgrounds.length})
          </div>
          <button
            onClick={addBackground}
            disabled={disabled}
            className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-40 border border-indigo-700/40 hover:border-indigo-500 rounded-md px-2 py-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        <div className="flex gap-3 flex-wrap">
          {blueprint.globalBackgrounds.map((bg, bgIdx) => (
            <div key={`bg-${bgIdx}-${bg.prompt.substring(0, 20)}`} className="flex flex-col gap-1 items-center">
              <div className="text-[9px] text-[#5a5a5a] font-medium">BG {bgIdx + 1}</div>
              <ImageTile
                prompt={bg.prompt}
                resolvedUrl={bg.resolvedUrl}
                settings={settings}
                width="w-36"
                height="h-24"
                onPreview={(url) => setPreviewModal({
                  url,
                  prompt: bg.prompt,
                  onPromptChange: (p) => updateBgPrompt(bgIdx, p)
                })}
                onDelete={blueprint.globalBackgrounds.length > 1 ? () => deleteBg(bgIdx) : undefined}
                onUrlResolved={(url) => setBgUrl(bgIdx, url)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Dialogue Rows ───────────────────────────────── */}
      {blueprint.scenes.map((scene, sceneIdx) => (
        <div
          key={`scene-${sceneIdx}`}
          className="bg-[#181818] border border-[#252525] rounded-xl p-3.5"
        >
          {/* Row header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold text-[#5a5a5a] uppercase tracking-widest mb-1">
                Dialogue {sceneIdx + 1} &nbsp;·&nbsp; {scene.startTime.toFixed(1)}s – {scene.endTime.toFixed(1)}s &nbsp;·&nbsp; {scene.duration.toFixed(1)}s
              </div>
              <div className="text-xs text-[#b0b0b0] leading-snug line-clamp-2">
                "{scene.narration}"
              </div>
            </div>

            {/* Background selector */}
            <div className="flex flex-col gap-1 shrink-0">
              <div className="text-[9px] text-[#5a5a5a] font-medium">Background</div>
              <div className="relative">
                <select
                  value={scene.selectedBackgroundIndex}
                  onChange={(e) => updateSceneBg(sceneIdx, parseInt(e.target.value))}
                  disabled={disabled}
                  className="appearance-none bg-[#0e0e0e] border border-[#2a2a2a] hover:border-indigo-600 focus:border-indigo-500 rounded-lg px-2.5 py-1 pr-6 text-[11px] text-white outline-none cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {blueprint.globalBackgrounds.map((_, bgIdx) => (
                    <option key={bgIdx} value={bgIdx}>BG {bgIdx + 1}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6a6a6a] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Map count badge */}
          {scene.pipItems.some(p => p.source === 'map') && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flex items-center gap-1 bg-blue-900/30 border border-blue-800/30 rounded-full px-2 py-0.5">
                <MapPin className="w-2.5 h-2.5 text-blue-400" />
                <span className="text-[9px] text-blue-400 font-medium">
                  {scene.pipItems.filter(p => p.source === 'map').length} map animation{scene.pipItems.filter(p => p.source === 'map').length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* PIP content tiles — scrollable row */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent">
            {scene.pipItems.map((pip, pipIdx) => (
              <PipTile
                key={`pip-${sceneIdx}-${pipIdx}-${pip.source}-${pip.prompt.substring(0, 12)}`}
                pip={pip}
                sceneIdx={sceneIdx}
                pipIdx={pipIdx}
                settings={settings}
                disabled={disabled}
                onDelete={scene.pipItems.length > 1 ? () => deletePip(sceneIdx, pipIdx) : undefined}
                onUpdatePip={(updated) => updatePip(sceneIdx, pipIdx, updated)}
                onPreviewImage={(url, prompt, onPromptChange) => setPreviewModal({ url, prompt, onPromptChange })}
                onEditMap={(p, onSave) => setMapEditModal({ pip: p, onSave })}
              />
            ))}

            {/* Add PIP tile */}
            {!disabled && (
              <button
                onClick={() => addPip(sceneIdx)}
                className="shrink-0 w-32 h-20 rounded-lg border border-dashed border-[#333] hover:border-indigo-600/60 flex flex-col items-center justify-center gap-1.5 transition-colors group mt-5"
              >
                <Plus className="w-4 h-4 text-[#5a5a5a] group-hover:text-indigo-400 transition-colors" />
                <span className="text-[9px] text-[#5a5a5a] group-hover:text-indigo-400 transition-colors">Add Content</span>
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Image Preview Modal */}
      {previewModal && (
        <ImagePreviewModal
          prompt={previewModal.prompt}
          url={previewModal.url}
          onClose={() => setPreviewModal(null)}
          onPromptChange={previewModal.onPromptChange}
        />
      )}

      {/* Map Edit Modal */}
      {mapEditModal && (
        <MapEditModal
          pip={mapEditModal.pip}
          onClose={() => setMapEditModal(null)}
          onSave={(updated) => {
            mapEditModal.onSave(updated);
            setMapEditModal(null);
          }}
        />
      )}
    </div>
  );
}
