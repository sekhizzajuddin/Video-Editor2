import { spring, easeOutCubic } from '../motionGraphicEasing';

export function VectorShape(
  ctx: CanvasRenderingContext2D,
  config: any,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
) {
  const shapes = config.shapes || [];
  if (!Array.isArray(shapes) || shapes.length === 0) return;

  // Global scale for the whole vector group (if it has popIn)
  const groupAnimation = config.animation || 'none';
  const groupStartTime = config.startTime || 0;
  let groupScale = 1;
  let groupOpacity = 1;

  if (localTime >= groupStartTime) {
    const elapsed = localTime - groupStartTime;
    if (groupAnimation === 'popSpring') {
      groupScale = spring(Math.min(1, elapsed / 0.8));
    } else if (groupAnimation === 'growUp') {
      groupScale = easeOutCubic(Math.min(1, elapsed / 0.6));
    }
  } else {
    groupScale = 0;
    groupOpacity = 0;
  }

  if (groupOpacity <= 0) return;

  ctx.save();
  // We assume the caller (renderer) translated to config.position already
  // But just in case, we apply scale
  
  if (groupAnimation === 'growUp') {
      // Scale Y from bottom
      ctx.scale(1, groupScale);
  } else {
      ctx.scale(groupScale, groupScale);
  }

  for (const shape of shapes) {
    const type = shape.type || 'rect';
    const fill = shape.fill || '#ffffff';
    
    // Individual shape delays
    const shapeStart = shape.delay || 0;
    if (localTime < groupStartTime + shapeStart) continue;

    ctx.fillStyle = fill;
    ctx.beginPath();

    if (type === 'polygon' && shape.points) {
      // points is an array of {x, y} or a string "x,y x,y x,y"
      let pts = [];
      if (typeof shape.points === 'string') {
        const pairs = shape.points.split(' ');
        for (const pair of pairs) {
          const [x, y] = pair.split(',').map(Number);
          if (!isNaN(x) && !isNaN(y)) pts.push({ x, y });
        }
      } else if (Array.isArray(shape.points)) {
        pts = shape.points;
      }
      
      if (pts.length > 0) {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }
    } else if (type === 'rect') {
      const rx = shape.rx || 0;
      if (rx > 0 && ctx.roundRect) {
        ctx.roundRect(shape.x || 0, shape.y || 0, shape.width || 100, shape.height || 100, rx);
        ctx.fill();
      } else {
        ctx.fillRect(shape.x || 0, shape.y || 0, shape.width || 100, shape.height || 100);
      }
    } else if (type === 'circle') {
      ctx.arc(shape.cx || 0, shape.cy || 0, shape.r || 50, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
