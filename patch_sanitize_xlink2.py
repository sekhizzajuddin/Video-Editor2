import re
import sys

with open('d:/Video-Editor/src/utils/cssSceneRasterizer.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'finalHtml\.replace\(/<svg\(\[\^>\]\*\)>/i, `<svg\$1>\n\$\{defs\}\n`\);', 
                 r'finalHtml.replace(/<svg([^>]*)>/i, `<svg$1 xmlns:xlink="http://www.w3.org/1999/xlink">\n${defs}\n`);', 
                 content)

with open('d:/Video-Editor/src/utils/cssSceneRasterizer.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched sanitizeMotionSceneHtml via regex")
