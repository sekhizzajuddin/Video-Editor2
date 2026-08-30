import re
import sys

with open('d:/Video-Editor/src/utils/cssSceneRasterizer.ts', 'r', encoding='utf-8') as f:
    content = f.read()

OLD_SERIALIZE = """  return `<svg xmlns="${SVG_NS}" width="${stage.width}" height="${stage.height}" viewBox="0 0 ${stage.width} ${stage.height}">` +"""
NEW_SERIALIZE = """  return `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${stage.width}" height="${stage.height}" viewBox="0 0 ${stage.width} ${stage.height}">` +"""

if OLD_SERIALIZE in content:
    content = content.replace(OLD_SERIALIZE, NEW_SERIALIZE)
    with open('d:/Video-Editor/src/utils/cssSceneRasterizer.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched cssSceneRasterizer.ts to include xmlns:xlink")
else:
    print("OLD_SERIALIZE not found!")
