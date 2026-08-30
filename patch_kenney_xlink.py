import re
import sys

with open('d:/Video-Editor/src/utils/kenneyAssets.ts', 'r', encoding='utf-8') as f:
    content = f.read()

OLD_DEFS = """    defs += `  <g id="${id}"><image href="${dataUri}" width="128" height="128" /></g>\\n`;"""
NEW_DEFS = """    defs += `  <g id="${id}"><image href="${dataUri}" xlink:href="${dataUri}" width="128" height="128" /></g>\\n`;"""

if OLD_DEFS in content:
    content = content.replace(OLD_DEFS, NEW_DEFS)
    with open('d:/Video-Editor/src/utils/kenneyAssets.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched kenneyAssets.ts to include xlink:href")
else:
    print("OLD_DEFS not found!")
