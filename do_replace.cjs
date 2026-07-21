const fs = require('fs');
let lines = fs.readFileSync('d:/Video-Editor/src/components/PreviewCanvas.tsx', 'utf8').split('\n');

const replacement = \                  if (t > 0.5) {
                    ctx.save();
                    ctx.globalAlpha = (t - 0.5) * 2;
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  } else {
                    await drawSingleClip(clipA, 1 - t);
                    await drawSingleClip(clipB, t);
                  }
                } catch (err) {
                  console.error('[CanvasRenderError] Failed to draw transition:', err);
                  try { ctx.restore(); } catch (_) {}
                }
              }
            });
            return;
          }

          const clip = sortedClips.find(
            (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration,
          );
          if (clip) {
            const z = clip.zIndex ?? (trackIdx * 10 + (isText ? 1000 : 0));
            drawQueue.push({
              zIndex: z,
              fn: async () => {
                try {
                  await drawSingleClip(clip, 1);
                } catch (err) {
                  console.error('[CanvasRenderError] Failed to draw clip:', clip.id, err);
                  try { ctx.restore(); } catch (_) {}
                }
              }
            });
          }
        });
      };

      const queuePipWindowsForTracks = (tracksList: any[], isText: boolean) => {
        const pipWindows = Object.values(useEditorStore.getState().pipWindows || {});
        tracksList.forEach((track, trackIdx) => {
          const activeClips = track.clips.filter(
            (c: any) => !c.disabled && currentTime >= c.startTime && currentTime < c.startTime + c.duration
          );

          for (const clip of activeClips) {
            const clipPips = pipWindows.filter(p => p && p.parentClipId === clip.id);
            for (const pip of clipPips) {
              const pipAbsStart = clip.startTime + (pip.relativeStartTime || 0);
              if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
                pip.tracks.forEach((pipTrack, ptIdx) => {
                  pipTrack.clips.forEach((pipClip) => {
                    const ptAbsStart = pipAbsStart + pipClip.startTime;
                    if (currentTime >= ptAbsStart && currentTime < ptAbsStart + pipClip.duration) {
                      const z = (clip.zIndex ?? (trackIdx * 10 + (isText ? 1000 : 0))) + 10000 + (pip.zIndex || 1) * 10 + ptIdx;
                      
                      const mockClip: any = {
                        ...pipClip,
                        startTime: ptAbsStart,
                        zIndex: z,
                        transform: pipClip.transform || {
                          scale: 30,
                          x: 30,
                          y: 30,
                          rotation: 0
                        }
                      };
                      
                      drawQueue.push({
                        zIndex: z,
                        fn: async () => {
                          try {
                            await drawSingleClip(mockClip as any, 1);
                          } catch (err) {
                            console.error('[CanvasRenderError] Failed to draw PIP layer:', pipClip.id, err);
                            try { ctx.restore(); } catch (_) {}
                          }
                        }
                      });
                    }
                  });
                });
              }
            }
          }
        });
      };

      // Queue Video tracks
      queueMainClipsForTracks(videoTracks, false);
      queuePipWindowsForTracks(videoTracks, false);

      // Queue Text tracks (Default 1000+ zIndex)
      queueMainClipsForTracks(textTracks, true);
      queuePipWindowsForTracks(textTracks, true);

      // Sort by Z-Index
      if (drawQueue.length > 1) drawQueue.sort((a, b) => a.zIndex - b.zIndex);

      // Execute drawing queue in order
      for (const task of drawQueue) {
        await task.fn();
      }

      if (!anyClipDrawn) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No clip at current position', W / 2, H / 2 - 10);
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText('Add clips to the timeline to preview', W / 2, H / 2 + 12);
      }
      
      if (!skipExpensiveFX) {
        for (const track of visualTracks) {
          for (const clip of track.clips) {
            if (!clip.disabled && clip.particleSettings && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
              renderParticles(ctx, clip.id, clip.particleSettings, W, H, deltaMs, particlePoolsRef.current);
            }
          }
          const pipWindows = useEditorStore.getState().pipWindows || {};
          for (const clip of (track.clips || [])) {
            const clipPips = Object.values(pipWindows).filter(p => p && (p as any).parentClipId === clip.id);
            for (const pip of (clipPips as any[])) {
              const pipAbsStart = clip.startTime + (pip.relativeStartTime || 0);
              if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
                for (const pipTrack of pip.tracks) {
                  for (const pipClip of pipTrack.clips) {
                    const ptAbsStart = pipAbsStart + pipClip.startTime;
                    if (!pipClip.disabled && pipClip.particleSettings && currentTime >= ptAbsStart && currentTime < ptAbsStart + pipClip.duration) {
                      renderParticles(ctx, pipClip.id, pipClip.particleSettings, W, H, deltaMs, particlePoolsRef.current);
                    }
                  }
                }
              }
            }
          }
        }
      }

      ctx.restore();

      // Render Subtitles
      const storeState = useEditorStore.getState();
      const subsList = (storeState as any).subtitles;
      const activeSubLanguage = (storeState as any).subtitleLanguage || 'en';
      if (subsList && subsList.length > 0) {
        const activeSub = subsList.find(
          (sub: any) => currentTime >= sub.startTime && currentTime <= sub.endTime
        );
        if (activeSub) {
          ctx.save();
          
          const baseFontSize = Math.max(12, Math.round(W * 0.038));
          ctx.font = \old \px "Inter", sans-serif\;
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
            const boxH = (lineHeight * lines.length) + paddingY * 1.5;
            
            const x = W / 2;
            const y = H - Math.max(25, H * 0.08);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
            ctx.beginPath();
            ctx.roundRect(x - boxW / 2, y - boxH, boxW, boxH, Math.max(4, baseFontSize * 0.25));
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;

            lines.forEach((line: string, index: number) => {
              const lineY = y - paddingY - (lines.length - 1 - index) * lineHeight;
              ctx.fillText(line, x, lineY);
            });
          }
          
          ctx.restore();
        }
      }\.split('\n');

lines.splice(2483, 2580 - 2483 + 1, ...replacement);
fs.writeFileSync('d:/Video-Editor/src/components/PreviewCanvas.tsx', lines.join('\n'));
console.log('Replaced block cleanly!');
