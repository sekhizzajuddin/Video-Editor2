with open('src/components/preview/CanvasRenderingEngine.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """        if (ts.animation) {
          const inDuration = ts.animation.inDuration || 0.1;
          const outDuration = ts.animation.outDuration || 0.1;"""

new_logic = """        let activeAnim = ts.animation;
        if (!activeAnim && ts.animationPreset && ts.animationPreset !== 'none') {
          activeAnim = {
            in: ts.animationPreset === 'subscribe' ? 'zoom' : (ts.animationPreset === 'bounce' ? 'bounce' : 'fadeIn'),
            out: 'fadeOut',
            inDuration: 0.5,
            outDuration: 0.5
          } as any;
        }
        if (activeAnim) {
          const inDuration = activeAnim.inDuration || 0.1;
          const outDuration = activeAnim.outDuration || 0.1;"""

content = content.replace(old_logic, new_logic)

# Replace ts.animation.in with activeAnim.in
old_switch1 = """            switch (ts.animation.in) {"""
new_switch1 = """            switch (activeAnim.in) {"""
content = content.replace(old_switch1, new_switch1)

old_switch2 = """            switch (ts.animation.out) {"""
new_switch2 = """            switch (activeAnim.out) {"""
content = content.replace(old_switch2, new_switch2)

with open('src/components/preview/CanvasRenderingEngine.ts', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/export/engine/Compositor.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_comp = """    private computeTextAnimation(clip: any, timestampSeconds?: number) {
      const out = { opacity: 1, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
      const anim = clip?.textSettings?.animation;
      if (!anim) return out;"""

new_comp = """    private computeTextAnimation(clip: any, timestampSeconds?: number) {
      const out = { opacity: 1, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
      let anim = clip?.textSettings?.animation;
      if (!anim && clip?.textSettings?.animationPreset && clip.textSettings.animationPreset !== 'none') {
        anim = {
          in: clip.textSettings.animationPreset === 'subscribe' ? 'zoom' : (clip.textSettings.animationPreset === 'bounce' ? 'bounce' : 'fadeIn'),
          out: 'fadeOut',
          inDuration: 0.5,
          outDuration: 0.5
        };
      }
      if (!anim) return out;"""
      
content = content.replace(old_comp, new_comp)

with open('src/export/engine/Compositor.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched fallbacks!")
