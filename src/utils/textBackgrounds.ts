export interface TextBackgroundStyle {
  id: string;
  name: string;
  category: string;
}

export const TEXT_BACKGROUNDS: TextBackgroundStyle[] = [
  { id: 'solid_pill', name: 'Solid Pill', category: 'Basic' },
  { id: 'sharp_rect', name: 'Sharp Rectangle', category: 'Basic' },
  { id: 'slanted_rect', name: 'Slanted Box', category: 'Basic' },
  { id: 'outline_box', name: 'Outline Box', category: 'Basic' },
  { id: 'marker_swipe', name: 'Marker Swipe', category: 'Brush & Paint' },
  { id: 'thick_brush', name: 'Thick Brush', category: 'Brush & Paint' },
  { id: 'jagged_paint', name: 'Jagged Paint', category: 'Brush & Paint' },
  { id: 'splatter', name: 'Ink Splatter', category: 'Brush & Paint' },
  { id: 'spray_paint', name: 'Spray Paint', category: 'Brush & Paint' },
  { id: 'hud_plate', name: 'HUD Plate', category: 'Sci-Fi' },
  { id: 'cyber_bracket', name: 'Cyber Bracket', category: 'Sci-Fi' },
  { id: 'neon_outline', name: 'Neon Outline', category: 'Sci-Fi' },
  { id: 'glitch_box', name: 'Glitch Box', category: 'Sci-Fi' },
  { id: 'action_burst', name: 'Action Burst', category: 'Comic' },
  { id: 'thought_cloud', name: 'Thought Cloud', category: 'Comic' },
  { id: 'speed_box', name: 'Speed Box', category: 'Comic' },
  { id: 'ribbon', name: 'Ribbon Banner', category: 'Retro' },
  { id: 'torn_paper', name: 'Torn Paper', category: 'Retro' },
  { id: 'ticket_stub', name: 'Ticket Stub', category: 'Retro' },
  { id: 'underline', name: 'Underline', category: 'Minimal' },
  { id: 'double_underline', name: 'Double Underline', category: 'Minimal' },
  { id: 'highlight', name: 'Text Highlight', category: 'Minimal' },
  { id: 'quote_bracket', name: 'Quote Bracket', category: 'Minimal' },
];

export function drawTextBackground(
  ctx: any, // CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  styleId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (styleId) {
    case 'sharp_rect':
      ctx.fillRect(x, y, w, h);
      break;

    case 'slanted_rect':
      ctx.beginPath();
      const slant = h * 0.3;
      ctx.moveTo(x + slant, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - slant, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      break;

    case 'outline_box':
      ctx.lineWidth = Math.max(2, h * 0.05);
      ctx.strokeRect(x, y, w, h);
      break;

    case 'marker_swipe':
      ctx.beginPath();
      ctx.moveTo(x - w * 0.02, y + h * 0.1);
      ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.05, x + w * 1.02, y + h * 0.15);
      ctx.lineTo(x + w * 1.03, y + h * 0.9);
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 1.05, x - w * 0.01, y + h * 0.85);
      ctx.closePath();
      ctx.fill();
      break;

    case 'thick_brush':
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.2);
      ctx.lineTo(x + w * 0.1, y);
      ctx.lineTo(x + w * 0.9, y + h * 0.05);
      ctx.lineTo(x + w, y + h * 0.3);
      ctx.lineTo(x + w * 0.95, y + h);
      ctx.lineTo(x + w * 0.1, y + h * 0.95);
      ctx.lineTo(x, y + h * 0.8);
      ctx.closePath();
      ctx.fill();
      break;

    case 'jagged_paint':
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.1);
      for (let i = 0; i <= 10; i++) {
        const px = x + (w * i) / 10;
        const py = y + (i % 2 === 0 ? 0 : h * 0.15);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x + w, y + h * 0.9);
      for (let i = 10; i >= 0; i--) {
        const px = x + (w * i) / 10;
        const py = y + h - (i % 2 === 0 ? 0 : h * 0.15);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;

    case 'splatter':
      ctx.fillRect(x + w * 0.05, y + h * 0.05, w * 0.9, h * 0.9);
      ctx.beginPath();
      ctx.arc(x - w * 0.05, y + h * 0.2, h * 0.15, 0, Math.PI * 2);
      ctx.arc(x + w * 1.05, y + h * 0.8, h * 0.2, 0, Math.PI * 2);
      ctx.arc(x + w * 0.8, y - h * 0.1, h * 0.1, 0, Math.PI * 2);
      ctx.arc(x + w * 0.2, y + h * 1.1, h * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'spray_paint':
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 1.8, h / 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 20; i++) {
        const r = Math.random() * Math.PI * 2;
        const d = Math.random() * h;
        ctx.beginPath();
        ctx.arc(x + w / 2 + Math.cos(r) * (w / 1.8 + d), y + h / 2 + Math.sin(r) * (h / 1.8 + d), Math.random() * h * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'hud_plate':
      ctx.beginPath();
      const cut = Math.min(w * 0.1, h * 0.3);
      ctx.moveTo(x + cut, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - cut);
      ctx.lineTo(x + w - cut, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + cut);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'white';
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      break;

    case 'cyber_bracket':
      ctx.lineWidth = Math.max(2, h * 0.08);
      const bCut = h * 0.3;
      ctx.beginPath();
      ctx.moveTo(x + bCut, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + bCut, y + h);
      ctx.moveTo(x + w - bCut, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - bCut, y + h);
      ctx.stroke();
      break;

    case 'neon_outline':
      ctx.lineWidth = Math.max(2, h * 0.05);
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 5;
      ctx.strokeRect(x, y, w, h);
      break;

    case 'glitch_box':
      ctx.fillStyle = color;
      ctx.fillRect(x - w * 0.02, y, w, h * 0.2);
      ctx.fillRect(x + w * 0.01, y + h * 0.25, w, h * 0.4);
      ctx.fillRect(x - w * 0.01, y + h * 0.7, w, h * 0.3);
      break;

    case 'action_burst':
      ctx.beginPath();
      const cx = x + w / 2;
      const cy = y + h / 2;
      const spikes = 12;
      const outR = Math.max(w, h) * 0.6;
      const inR = Math.max(w, h) * 0.45;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = (i * Math.PI) / spikes;
        const r = i % 2 === 0 ? outR : inR;
        if (i === 0) ctx.moveTo(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r);
        else ctx.lineTo(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;

    case 'thought_cloud':
      ctx.beginPath();
      ctx.arc(x + w * 0.2, y + h * 0.5, h * 0.6, 0, Math.PI * 2);
      ctx.arc(x + w * 0.5, y + h * 0.3, h * 0.7, 0, Math.PI * 2);
      ctx.arc(x + w * 0.8, y + h * 0.5, h * 0.6, 0, Math.PI * 2);
      ctx.arc(x + w * 0.5, y + h * 0.7, h * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'speed_box':
      ctx.beginPath();
      ctx.moveTo(x + h * 0.5, y);
      ctx.lineTo(x + w + h * 0.2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x - h * 0.2, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - h * 0.5, y + h * 0.2);
      ctx.lineTo(x - h * 0.1, y + h * 0.2);
      ctx.moveTo(x - h * 0.7, y + h * 0.6);
      ctx.lineTo(x - h * 0.3, y + h * 0.6);
      ctx.moveTo(x - h * 0.4, y + h * 0.8);
      ctx.lineTo(x - h * 0.0, y + h * 0.8);
      ctx.lineWidth = h * 0.1;
      ctx.stroke();
      break;

    case 'ribbon':
      const tip = h * 0.4;
      ctx.beginPath();
      ctx.moveTo(x - tip, y + h / 2);
      ctx.lineTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w + tip, y + h / 2);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      break;

    case 'torn_paper':
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      for (let py = y; py <= y + h; py += h / 8) {
        ctx.lineTo(x + w + (Math.random() * h * 0.2 - h * 0.1), py);
      }
      ctx.lineTo(x, y + h);
      for (let py = y + h; py >= y; py -= h / 8) {
        ctx.lineTo(x + (Math.random() * h * 0.2 - h * 0.1), py);
      }
      ctx.closePath();
      ctx.fill();
      break;

    case 'ticket_stub':
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.arc(x + w, y + h / 2, h * 0.2, -Math.PI / 2, Math.PI / 2, true);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.arc(x, y + h / 2, h * 0.2, Math.PI / 2, -Math.PI / 2, true);
      ctx.closePath();
      ctx.fill();
      break;

    case 'underline':
      ctx.fillRect(x, y + h * 0.8, w, h * 0.1);
      break;

    case 'double_underline':
      ctx.fillRect(x, y + h * 0.8, w, h * 0.08);
      ctx.fillRect(x, y + h * 0.95, w, h * 0.04);
      break;

    case 'highlight':
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = color;
      ctx.fillRect(x, y + h * 0.4, w, h * 0.6);
      ctx.globalCompositeOperation = 'source-over';
      break;

    case 'quote_bracket':
      ctx.lineWidth = Math.max(3, h * 0.1);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.1, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w * 0.1, y + h);
      ctx.moveTo(x + w * 0.9, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w * 0.9, y + h);
      ctx.stroke();
      break;

    case 'solid_pill':
    default:
      const radius = Math.min(8, h / 4);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}
