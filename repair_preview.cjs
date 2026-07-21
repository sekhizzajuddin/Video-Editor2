const fs = require('fs');
let code = fs.readFileSync('d:/Video-Editor/src/components/PreviewCanvas.tsx', 'utf8');

const brokenSub = 'const subsList = (storeState as any).subtitles;\n    const activeSubLanguage = (storeState as any).subtitleLanguage || \'en\';\n    if (subsList && subsList.length > 0) {\n      const activeSub = subsList.find(\n          const boxH = (lineHeight * lines.length) + paddingY * 1.5;';

const fixedSub = \const subsList = (storeState as any).subtitles;
    const activeSubLanguage = (storeState as any).subtitleLanguage || 'en';
    if (subsList && subsList.length > 0) {
      const activeSub = subsList.find(
        (sub: any) => currentTime >= sub.startTime && currentTime <= sub.endTime
      );
      if (activeSub) {
        ctx.save();
        
        const baseFontSize = Math.max(12, Math.round(W * 0.038));
        ctx.font = \\\old \\\px "Inter", sans-serif\\\;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const textToDraw = activeSub.translations?.[activeSubLanguage] || activeSub.text || '';

        if (textToDraw.trim()) {
          const lines = textToDraw.split('\\n');
          const paddingX = baseFontSize * 0.7;
          const paddingY = baseFontSize * 0.35;
          const lineHeight = baseFontSize * 1.25;
          
          let maxLineWidth = 0;
          lines.forEach((line: string) => {
            const width = ctx.measureText(line).width;
            if (width > maxLineWidth) maxLineWidth = width;
          });

          const boxW = maxLineWidth + paddingX * 2;
          const boxH = (lineHeight * lines.length) + paddingY * 1.5;\;

if (code.includes(brokenSub)) {
  code = code.replace(brokenSub, fixedSub);
  console.log('Fixed sub');
}

const brokenGrid = \      // Rule-of-thirds intersection dots
      ctx.fillStyle = 'rgba(251,191,36,0.7)';
      for (let c = 1; c < COLS; c++) {

        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        const trW = W * 0.1;
        const trH = H * 0.1;
        const trX = offsetX + W - trW;
        const trY = offsetY;
        ctx.fillRect(trX, trY, trW, trH);
        ctx.strokeRect(trX, trY, trW, trH);
        ctx.fillStyle = 'white';
        ctx.fillText('Info', trX + trW/2, trY + trH/2);
        
      } else if (aspectRatio === '9:16') {\;

const fixedGrid = \      // Rule-of-thirds intersection dots
      ctx.fillStyle = 'rgba(251,191,36,0.7)';
      for (let c = 1; c < COLS; c++) {
        for (let r = 1; r < ROWS; r++) {
          ctx.beginPath();
          ctx.arc(offsetX + c * cellW, offsetY + r * cellH, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // Safe Zones Overlay
    if (settings.showSafeZones && !isExporting) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Red-ish blind spot
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (aspectRatio === '16:9') {
        const brW = W * 0.15;
        const brH = H * 0.12;
        const brX = offsetX + W - brW;
        const brY = offsetY + H - brH;
        ctx.fillRect(brX, brY, brW, brH);
        ctx.strokeRect(brX, brY, brW, brH);
        ctx.fillStyle = 'white';
        ctx.fillText('Logo/Time', brX + brW/2, brY + brH/2);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        const trW = W * 0.1;
        const trH = H * 0.1;
        const trX = offsetX + W - trW;
        const trY = offsetY;
        ctx.fillRect(trX, trY, trW, trH);
        ctx.strokeRect(trX, trY, trW, trH);
        ctx.fillStyle = 'white';
        ctx.fillText('Info', trX + trW/2, trY + trH/2);
      } else if (aspectRatio === '9:16') {\;

if (code.includes(brokenGrid)) {
  code = code.replace(brokenGrid, fixedGrid);
  console.log('Fixed grid');
}

fs.writeFileSync('d:/Video-Editor/src/components/PreviewCanvas.tsx', code);
