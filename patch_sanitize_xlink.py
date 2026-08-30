import re
import sys

with open('d:/Video-Editor/src/utils/cssSceneRasterizer.ts', 'r', encoding='utf-8') as f:
    content = f.read()

OLD_REPLACE = """    if (finalHtml.includes('<svg')) {
      finalHtml = finalHtml.replace(/<svg([^>]*)>/i, `<svg$1>\\n${defs}\\n`);
    } else {"""
NEW_REPLACE = """    if (finalHtml.includes('<svg')) {
      finalHtml = finalHtml.replace(/<svg([^>]*)>/i, `<svg$1 xmlns:xlink="http://www.w3.org/1999/xlink">\\n${defs}\\n`);
    } else {"""

if OLD_REPLACE in content:
    content = content.replace(OLD_REPLACE, NEW_REPLACE)
    with open('d:/Video-Editor/src/utils/cssSceneRasterizer.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched sanitizeMotionSceneHtml to include xmlns:xlink")
else:
    print("OLD_REPLACE not found!")
