import re

with open('src/utils/kineticTypography.ts', 'r', encoding='utf-8') as f:
    content = f.read()

bg_logic = """
      // Record the authored line arrangement on the container so later resizes
      // reproduce it exactly instead of re-deriving it from word positions.
      (primaryClip as any).kineticLineStructure = lines.map((l) => l.length);

      if (options.pipBackgroundArea) {
        primaryClip.textSettings = primaryClip.textSettings || {} as any;
        primaryClip.textSettings.text = lines.map(l => l.map(item => item.word.text).join(' ')).join('\\n');
        primaryClip.textSettings.fontSize = baseFontSize;
        primaryClip.textSettings.color = 'transparent';
        primaryClip.textSettings.backgroundColor = 'rgba(0,0,0,0.8)';
        primaryClip.textSettings.backgroundStyle = (options.backgroundSelection && options.backgroundSelection !== 'none' && options.backgroundSelection !== 'random') ? options.backgroundSelection : 'solid_pill';
        primaryClip.textSettings.fontFamily = grp[0].fontFamily || 'Inter';
      }
"""

content = content.replace('      // Record the authored line arrangement on the container so later resizes\n      // reproduce it exactly instead of re-deriving it from word positions.\n      (primaryClip as any).kineticLineStructure = lines.map((l) => l.length);', bg_logic)

with open('src/utils/kineticTypography.ts', 'w', encoding='utf-8') as f:
    f.write(content)
