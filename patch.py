import re

with open('src/utils/kineticTypography.ts', 'r', encoding='utf-8') as f:
    content = f.read()

bg_logic = """5. PREFERENCES: 
${userStyle !== 'random' ? `STYLE PRESET PREFERENCE: Lean towards "${userStyle}" style where possible.` : ''}
${userAnim !== 'random' ? `ANIMATION PREFERENCE: Prefer "${userAnim}" for animation where applicable.` : ''}
${options.pipBackgroundArea ? 'BACKGROUND PREFERENCE: DO NOT generate any backgroundColor or backgroundStyle for the individual words. It will be handled globally.' : (options.backgroundSelection && options.backgroundSelection !== 'random' && options.backgroundSelection !== 'none' ? `BACKGROUND PREFERENCE: You MUST use the "${options.backgroundSelection}" backgroundStyle for the words.` : (options.backgroundSelection === 'none' ? 'BACKGROUND PREFERENCE: DO NOT use any backgroundStyle.' : ''))}
"""

content = content.replace('5. PREFERENCES: \n${userStyle !== \'random\' ? `STYLE PRESET PREFERENCE: Lean towards "${userStyle}" style where possible.` : \'\'}\n${userAnim !== \'random\' ? `ANIMATION PREFERENCE: Prefer "${userAnim}" for animation where applicable.` : \'\'}', bg_logic)

with open('src/utils/kineticTypography.ts', 'w', encoding='utf-8') as f:
    f.write(content)
