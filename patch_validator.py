import re
import sys

with open('d:/Video-Editor/src/utils/generateMotionGraphicsFromDialogue.ts', 'r', encoding='utf-8') as f:
    content = f.read()

VALIDATE_OLD = """        `Scene ${index + 1} ("${scene.description || 'untitled'}") contains only ${shapes} SVG shape elements, ` +
          `but a "${style}" scene needs at least ${minimum}. Add real artwork: <polygon>, <path>, <rect>, ` +
          `<circle>, <ellipse>, <line> arranged into recognisable objects (terrain, buildings, people, ` +
          `maps, charts) — not more text.`"""

VALIDATE_NEW = """        `Scene ${index + 1} ("${scene.description || 'untitled'}") contains only ${shapes} SVG shape elements, ` +
          `but a "${style}" scene needs at least ${minimum}. Add real artwork: <use> tags for 3D assets, <polygon>, <path>, <rect>, ` +
          `<circle>, <ellipse>, <line> arranged into recognisable objects (terrain, buildings, people, ` +
          `maps, charts) — not more text.`"""

content = content.replace(VALIDATE_OLD, VALIDATE_NEW)

with open('d:/Video-Editor/src/utils/generateMotionGraphicsFromDialogue.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("generateMotionGraphicsFromDialogue.ts updated successfully (validator).")
