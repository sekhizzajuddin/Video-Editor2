import re

with open('src/components/preview/CanvasRenderingEngine.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find the block:
#        const textOuterCtx = ctx;
#        ctx = textTargetCtx;
#  
#        ctx.save();
#        // Opacity/blend are applied when the buffer is composited, not inside it.
#        ctx.globalAlpha = textBuffer ? animOpacity : ctx.globalAlpha * animOpacity;
#        ctx.translate(animOffsetX, animOffsetY);
#        ctx.scale(animScaleX, animScaleY);
old_block = """        const textOuterCtx = ctx;
        ctx = textTargetCtx;
  
        ctx.save();
        // Opacity/blend are applied when the buffer is composited, not inside it.
        ctx.globalAlpha = textBuffer ? animOpacity : ctx.globalAlpha * animOpacity;
        ctx.translate(animOffsetX, animOffsetY);
        ctx.scale(animScaleX, animScaleY);"""

new_block = """        const textOuterCtx = ctx;
        ctx = textTargetCtx;
  
        ctx.save();
        // Opacity/blend are applied when the buffer is composited, not inside it.
        ctx.globalAlpha = textBuffer ? 1 : ctx.globalAlpha * animOpacity;
        if (!textBuffer) {
          ctx.translate(animOffsetX, animOffsetY);
          ctx.scale(animScaleX, animScaleY);
        }"""

content = content.replace(old_block, new_block)

# Now we need to find the compositing block:
#            if (textNeedsCrop) {
#              // ...
#                cCtx.drawImage(textBuffer, sx, sy, sw, sh, 0, 0, cropped.width, cropped.height);
#                ctx.save();
#                ctx.globalAlpha = ctx.globalAlpha * animOpacity;
#                drawPerspectiveTexture(ctx, cropped, corners);
#                ctx.restore();
#              }
#            } else {
#              ctx.save();
#              ctx.globalAlpha = ctx.globalAlpha * animOpacity;
#              drawPerspectiveTexture(ctx, textBuffer, corners);
#              ctx.restore();
#            }
#          } else {
#            // No perspective: ...
#            ctx.save();
#            ctx.globalAlpha = ctx.globalAlpha * animOpacity;
#            ctx.drawImage(textBuffer, sx, sy, sw, sh, dxT, dyT, sw, sh);

old_composite = """                ctx.save();
                ctx.globalAlpha = ctx.globalAlpha * animOpacity;
                drawPerspectiveTexture(ctx, cropped, corners);
                ctx.restore();
              }
            } else {
              ctx.save();
              ctx.globalAlpha = ctx.globalAlpha * animOpacity;
              drawPerspectiveTexture(ctx, textBuffer, corners);
              ctx.restore();
            }
          } else {
            // No perspective: the shared transform block already positioned `ctx`,
            // so blit the buffer back around the origin it was drawn about.
            const dxT = -textBufW / 2 + sx;
            const dyT = -textBufH / 2 + sy;
            ctx.save();
            ctx.globalAlpha = ctx.globalAlpha * animOpacity;
            ctx.drawImage(textBuffer, sx, sy, sw, sh, dxT, dyT, sw, sh);
            ctx.restore();
          }"""

new_composite = """                ctx.save();
                ctx.globalAlpha = ctx.globalAlpha * animOpacity;
                const tCenter = { x: cx + aX, y: cy + aY };
                ctx.translate(tCenter.x, tCenter.y);
                ctx.translate(animOffsetX, animOffsetY);
                ctx.scale(animScaleX, animScaleY);
                ctx.translate(-tCenter.x, -tCenter.y);
                drawPerspectiveTexture(ctx, cropped, corners);
                ctx.restore();
              }
            } else {
              ctx.save();
              ctx.globalAlpha = ctx.globalAlpha * animOpacity;
              const tCenter = { x: cx + aX, y: cy + aY };
              ctx.translate(tCenter.x, tCenter.y);
              ctx.translate(animOffsetX, animOffsetY);
              ctx.scale(animScaleX, animScaleY);
              ctx.translate(-tCenter.x, -tCenter.y);
              drawPerspectiveTexture(ctx, textBuffer, corners);
              ctx.restore();
            }
          } else {
            // No perspective: the shared transform block already positioned `ctx`,
            // so blit the buffer back around the origin it was drawn about.
            const dxT = -textBufW / 2 + sx;
            const dyT = -textBufH / 2 + sy;
            ctx.save();
            ctx.globalAlpha = ctx.globalAlpha * animOpacity;
            // The context is already positioned at cx, cy by the shared transform block
            ctx.translate(animOffsetX, animOffsetY);
            ctx.scale(animScaleX, animScaleY);
            ctx.drawImage(textBuffer, sx, sy, sw, sh, dxT, dyT, sw, sh);
            ctx.restore();
          }"""

content = content.replace(old_composite, new_composite)

with open('src/components/preview/CanvasRenderingEngine.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched!")
