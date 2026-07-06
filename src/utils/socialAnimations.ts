export function drawSubscribeAnimation(
  ctx: CanvasRenderingContext2D,
  localTime: number,
  duration: number,
  dw: number,
  dh: number
) {
  const popIn = Math.min(1, Math.max(0, localTime / 0.5));
  const popOut = Math.min(1, Math.max(0, (duration - localTime) / 0.5));
  const scale = popIn * popOut;
  if (scale <= 0) return;

  // The state variables
  const isSubscribed = localTime > 2.0;
  const isBellRung = localTime > 3.0;
  const isBellRinging = localTime > 3.0 && localTime < 3.5;

  ctx.save();
  ctx.scale(scale, scale);

  // --- Draw Button ---
  const btnW = 220;
  const btnH = 60;
  const btnX = -btnW / 2;
  const btnY = -btnH / 2;
  
  // Scale button down slightly on click
  const btnScale = (localTime > 1.9 && localTime < 2.1) ? 0.95 : 1;
  ctx.save();
  ctx.scale(btnScale, btnScale);
  
  // Button background
  ctx.fillStyle = isSubscribed ? '#3f3f3f' : '#cc0000'; // Dark gray or YouTube Red
  if (typeof (ctx as any).roundRect === 'function') {
    ctx.beginPath();
    (ctx as any).roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();
  } else {
    ctx.fillRect(btnX, btnY, btnW, btnH);
  }

  // Button text
  ctx.fillStyle = isSubscribed ? '#aaaaaa' : '#ffffff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isSubscribed ? 'SUBSCRIBED' : 'SUBSCRIBE', 0, 2);
  ctx.restore();

  // --- Draw Bell ---
  if (isSubscribed) {
    const bellX = btnW / 2 + 40;
    const bellY = 0;
    
    // Bell ringing animation (wobble)
    let bellRot = 0;
    if (isBellRinging) {
      bellRot = Math.sin((localTime - 3.0) * 40) * 0.3;
    }
    const bellScale = (localTime > 2.9 && localTime < 3.1) ? 0.9 : 1;
    
    ctx.save();
    ctx.translate(bellX, bellY);
    ctx.rotate(bellRot);
    ctx.scale(bellScale, bellScale);
    
    // Draw bell icon (using simple paths)
    ctx.fillStyle = isBellRung ? '#f59e0b' : '#aaaaaa'; // Amber if rung, gray if not
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.bezierCurveTo(10, -15, 15, -5, 15, 5);
    ctx.lineTo(20, 15);
    ctx.lineTo(-20, 15);
    ctx.lineTo(-15, 5);
    ctx.bezierCurveTo(-15, -5, -10, -15, 0, -15);
    ctx.fill();
    // Clapper
    ctx.beginPath();
    ctx.arc(0, 18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- Draw Cursor ---
  let cursorX = dw / 2;
  let cursorY = dh / 2;
  
  if (localTime < 0.5) {
    // offscreen
    cursorX = dw / 2;
    cursorY = dh / 2;
  } else if (localTime >= 0.5 && localTime < 2.0) {
    // fly to button
    const t = (localTime - 0.5) / 1.5;
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in out
    cursorX = (dw / 2) + ease * (0 - dw / 2);
    cursorY = (dh / 2) + ease * (0 - dh / 2);
  } else if (localTime >= 2.0 && localTime < 2.1) {
    // click button
    cursorX = 0;
    cursorY = 0;
  } else if (localTime >= 2.1 && localTime < 3.0) {
    // fly to bell
    const t = (localTime - 2.1) / 0.9;
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    cursorX = 0 + ease * (btnW / 2 + 40);
    cursorY = 0;
  } else if (localTime >= 3.0 && localTime < 3.5) {
    // click bell
    cursorX = btnW / 2 + 40;
    cursorY = 0;
  } else if (localTime >= 3.5) {
    // fly away
    const t = Math.min(1, (localTime - 3.5) / 1.0);
    const ease = t * t;
    cursorX = (btnW / 2 + 40) + ease * (dw / 2);
    cursorY = 0 + ease * (dh / 2);
  }

  // Draw simple mac-like cursor
  ctx.save();
  ctx.translate(cursorX, cursorY);
  // Scale down on click
  if ((localTime >= 1.95 && localTime <= 2.05) || (localTime >= 2.95 && localTime <= 3.05)) {
    ctx.scale(0.8, 0.8);
  }
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(15, 15);
  ctx.lineTo(7, 15);
  ctx.lineTo(0, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}
