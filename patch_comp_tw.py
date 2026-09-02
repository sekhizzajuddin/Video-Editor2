with open('src/export/engine/Compositor.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_tw = """      // Typewriter in-animation progressively reveals characters (mirrors preview).
      if (ts.animation && ts.animation.in === 'typewriter' && ts.text) {
        const inDuration = ts.animation.inDuration || 0.1;"""

new_tw = """      // Typewriter in-animation progressively reveals characters (mirrors preview).
      let activeAnim = ts.animation;
      if (!activeAnim && ts.animationPreset && ts.animationPreset !== 'none') {
        activeAnim = { in: ts.animationPreset === 'subscribe' ? 'zoom' : (ts.animationPreset === 'bounce' ? 'bounce' : 'fadeIn'), out: 'fadeOut', inDuration: 0.5, outDuration: 0.5 } as any;
      }
      if (activeAnim && activeAnim.in === 'typewriter' && ts.text) {
        const inDuration = activeAnim.inDuration || 0.1;"""

content = content.replace(old_tw, new_tw)

with open('src/export/engine/Compositor.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched compositor tw!")
