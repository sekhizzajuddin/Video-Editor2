import re

with open('src/components/properties/tabs/effects/KineticTypographySection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
content = content.replace("import { TEXT_TEMPLATES } from '@/utils/textTemplates';", "import { TEXT_TEMPLATES } from '@/utils/textTemplates';\nimport { TEXT_BACKGROUNDS } from '@/utils/textBackgrounds';")

# 2. Add state
state_block = """  const [kineticTypoAnimation, setKineticTypoAnimation] = useState<string>('random');
  const [kineticTypoBackground, setKineticTypoBackground] = useState<string>('none');
  const [pipBackgroundArea, setPipBackgroundArea] = useState(false);"""
content = content.replace("  const [kineticTypoAnimation, setKineticTypoAnimation] = useState<string>('random');", state_block)

# 3. Add to options object
options_block = """          styleSelection: kineticTypoStyle,
          animationSelection: kineticTypoAnimation,
          backgroundSelection: kineticTypoBackground,
          pipBackgroundArea: pipBackgroundArea,"""
content = content.replace("          styleSelection: kineticTypoStyle,\n          animationSelection: kineticTypoAnimation,", options_block)

# 4. Add JSX
jsx_block = """            {/* Text Background Style Selection */}
            <div className="flex flex-col gap-1.5 border-t border-[#2d2d2d] pt-3">
              <label className="text-[10px] text-[var(--theme-text-muted)] uppercase font-bold tracking-wider">
                Text Background Style
              </label>
              <select
                value={kineticTypoBackground}
                onChange={(e) => setKineticTypoBackground(e.target.value)}
                className="bg-[#151515] text-white text-xs border border-[var(--theme-border)] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
              >
                <option value="none">None</option>
                <option value="random">AI / Random Backgrounds</option>
                {TEXT_BACKGROUNDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.category}: {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* PiP Background Checkbox (Hybrid only) */}
            {kineticTypoType === 'hybrid' && kineticTypoBackground !== 'none' && (
              <div className="space-y-2 border-t border-[#2d2d2d] pt-3 animate-fadeIn">
                 <label className="flex items-center gap-2 p-2 bg-[#151515] border border-[#2d2d2d] rounded cursor-pointer text-xs select-none hover:border-teal-500/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={pipBackgroundArea}
                      onChange={(e) => setPipBackgroundArea(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-[var(--theme-border)] bg-[#2a2a2a] text-teal-500 focus:ring-teal-500 focus:ring-offset-[#1e1e1e]"
                    />
                    <span className="text-white text-[10px] font-medium">Add background to entire PiP Area</span>
                  </label>
                  <p className="text-[10px] text-[var(--theme-text-muted)] leading-tight">
                    Instead of individual word backgrounds, apply one large background behind the entire sentence.
                  </p>
              </div>
            )}

            {/* \uD83D\uDCA5 Custom AI Prompt \uD83D\uDCA5 */}"""

content = content.replace("            {/* \uD83D\uDCA5 Custom AI Prompt \uD83D\uDCA5 */}", jsx_block)

with open('src/components/properties/tabs/effects/KineticTypographySection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
