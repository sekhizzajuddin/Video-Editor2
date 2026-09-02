import re

with open('src/utils/kineticTypography.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Instead of using hardcoded line numbers which might have shifted, 
# let's find the boundaries dynamically or just replace the previous block we inserted.

# But we know the file right now HAS the chunking loop because we just wrote it.
# Let's just fix the variables by replacing text.
with open('src/utils/kineticTypography.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Move variable declarations OUTSIDE the loop.
# We will just remove 'let ' or 'const ' from inside the loop and put them before `for (let i = 0...`
setup_vars = """
  let activeCasing = options.casing || 'first_letter_caps';
  const userStyle = options.styleSelection || 'random';
  const userAnim = options.animationSelection || 'random';
"""

content = content.replace("  let allTypoResults: any[] = [];", "  let allTypoResults: any[] = [];\n" + setup_vars)

# Remove the 'let' and 'const' from inside the loop and fix the casing check
content = content.replace("    let activeCasing = options.casing || 'first_letter_caps';", "    activeCasing = options.casing || 'first_letter_caps';")
content = content.replace("    if (activeCasing === 'all_lowercase') casingInstruction = \"output all text in lowercase (e.g. 'hello world').\";", "")
content = content.replace("    const userStyle = options.stylePreset || 'random';", "")
content = content.replace("    const userAnim = options.animation || 'random';", "")

# In the prompt string, we still use userStyle and userAnim, but they are now available from the outer scope!

with open('src/utils/kineticTypography.ts', 'w', encoding='utf-8') as f:
    f.write(content)

