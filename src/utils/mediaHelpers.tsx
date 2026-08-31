
import React from 'react';
import { Film, Music, Image, FileText, Sparkles } from 'lucide-react';
import { MediaType } from '@/types';

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatSimpleTime(seconds: number): string {
  const s = Math.floor(seconds % 60);
  return `${s}s`;
}

export function formatSize(bytes?: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function getMediaColor(type: MediaType): string {
  switch (type) {
    case 'video': return 'border-blue-500/30 hover:border-blue-500 text-blue-400';
    case 'audio': return 'border-emerald-500/30 hover:border-emerald-500 text-emerald-400';
    case 'image': return 'border-purple-500/30 hover:border-purple-500 text-purple-400';
    case 'text': return 'border-amber-500/30 hover:border-amber-500 text-amber-400';
    case 'fx': return 'border-rose-500/30 hover:border-rose-500 text-rose-400';
    default: return 'border-border hover:border-border text-muted-foreground';
  }
}

export function getMediaIcon(type: MediaType) {
  switch (type) {
    case 'video': return <Film className="w-4 h-4 text-blue-400" />;
    case 'audio': return <Music className="w-4 h-4 text-emerald-400" />;
    case 'image': return <Image className="w-4 h-4 text-purple-400" />;
    case 'text': return <FileText className="w-4 h-4 text-amber-400" />;
    case 'fx': return <Sparkles className="w-4 h-4 text-rose-400" />;
    default: return <Film className="w-4 h-4 text-muted-foreground" />;
  }
}
