import re

with open('src/utils/kineticTypography.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find the Smart Non-Overlapping Layout section.
# It looks like:
#        const charWidth = baseFontSize * 0.65;
#        const spaceWidth = baseFontSize * 0.4;
#        const lineHeight = baseFontSize * 1.35;
#
#        const lines: { word: any; width: number }[][] = [[]];
#        let currentLineWidth = 0;
#
#        grp.forEach((w) => {
#          const prevWordInLine = lines[lines.length - 1].length > 0 ? lines[lines.length - 1][lines[lines.length - 1].length - 1].word : null;
#          const wWidth = Math.round(w.text.length * charWidth);

old_measure = """        const charWidth = baseFontSize * 0.65;
        const spaceWidth = baseFontSize * 0.4;
        const lineHeight = baseFontSize * 1.35;
  
        const lines: { word: any; width: number }[][] = [[]];
        let currentLineWidth = 0;
  
        grp.forEach((w) => {
          const prevWordInLine = lines[lines.length - 1].length > 0 ? lines[lines.length - 1][lines[lines.length - 1].length - 1].word : null;
          const wWidth = Math.round(w.text.length * charWidth);"""

new_measure = """        const charWidth = baseFontSize * 0.65;
        let spaceWidth = baseFontSize * 0.4;
        const lineHeight = baseFontSize * 1.35;
  
        const lines: { word: any; width: number }[][] = [[]];
        let currentLineWidth = 0;

        const mCanvas = document.createElement('canvas');
        const mCtx = mCanvas.getContext('2d');
  
        grp.forEach((w) => {
          const prevWordInLine = lines[lines.length - 1].length > 0 ? lines[lines.length - 1][lines[lines.length - 1].length - 1].word : null;
          
          let wWidth = Math.round(w.text.length * charWidth);
          if (mCtx) {
            const preset = TEXT_TEMPLATES.find(p => p.name.toLowerCase() === (w.stylePreset || '').toLowerCase());
            const wFontFamily = w.fontFamily || preset?.settings.fontFamily || 'Inter';
            const wFontSize = w.fontSize || baseFontSize;
            const fw = preset?.settings.bold ? 'bold ' : '';
            const fi = preset?.settings.italic ? 'italic ' : '';
            mCtx.font = `${fw}${fi}${wFontSize}px ${wFontFamily}`;
            wWidth = mCtx.measureText(w.text).width;
            spaceWidth = mCtx.measureText(' ').width || (baseFontSize * 0.4);
          }
"""

content = content.replace(old_measure, new_measure)


# Now fix the individual word backgrounds when options.pipBackgroundArea is true!
# In the `line.forEach` loop:
#            const wordBgColor = word.backgroundColor || preset?.settings.backgroundColor || 'transparent';
#            const wordBgStyle = word.backgroundStyle || preset?.settings.backgroundStyle;
old_bg = """            const wordBgColor = word.backgroundColor || preset?.settings.backgroundColor || 'transparent';
            const wordBgStyle = word.backgroundStyle || preset?.settings.backgroundStyle;"""

new_bg = """            const wordBgColor = options.pipBackgroundArea ? 'transparent' : (word.backgroundColor || preset?.settings.backgroundColor || 'transparent');
            const wordBgStyle = options.pipBackgroundArea ? 'none' : (word.backgroundStyle || preset?.settings.backgroundStyle);"""

content = content.replace(old_bg, new_bg)

with open('src/utils/kineticTypography.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched kineticTypography measure!")
