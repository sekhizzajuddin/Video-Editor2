import re

with open('src/components/preview/CanvasRenderingEngine.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """        if (ts.animation) {
          const inDuration = ts.animation.inDuration || 0.1;
          const outDuration = ts.animation.outDuration || 0.1;"""

new_logic = """        import_statement = "import { presetToTextAnimation } from '@/utils/textTemplates';"
        # Actually I can't easily add import if it's not there, I will just manually map it if needed.
        # But wait, I can just use ts.animation as is, and fallback locally if needed.
"""
