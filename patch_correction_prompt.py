import re
import sys

with open('d:/Video-Editor/src/utils/generateMotionGraphicsFromDialogue.ts', 'r', encoding='utf-8') as f:
    content = f.read()

CORRECTION_PROMPT_OLD = """1. Every scene is a drawn world inside <svg viewBox="0 0 1920 1080"> with ${minimum}+ shape
   elements (polygon/path/rect/circle/ellipse/line). No scene may be text-only."""

CORRECTION_PROMPT_NEW = """1. Every scene is a drawn world inside <svg viewBox="0 0 1920 1080"> with ${minimum}+ shape
   elements (<use> tags for buildings/cities, or polygon/path/rect/circle/ellipse/line for charts). No scene may be text-only."""

content = content.replace(CORRECTION_PROMPT_OLD, CORRECTION_PROMPT_NEW)

with open('d:/Video-Editor/src/utils/generateMotionGraphicsFromDialogue.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("generateMotionGraphicsFromDialogue.ts updated successfully (correction prompt).")
