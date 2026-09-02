import re

with open('src/components/preview/CanvasRenderingEngine.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_tw = """        if (ts.animation && ts.animation.in === 'typewriter') {"""
new_tw = """        if (activeAnim && activeAnim.in === 'typewriter') {"""
content = content.replace(old_tw, new_tw)

with open('src/components/preview/CanvasRenderingEngine.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched typewriter!")
