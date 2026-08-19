import re

with open('src/mobile/App.tsx', 'r', encoding='utf8') as f:
    app_code = f.read()
    
app_code = re.sub(
    r"initialTab=\{([a-zA-Z]+) as any\}",
    r"category={\1 as any}",
    app_code
)

with open('src/mobile/App.tsx', 'w', encoding='utf8') as f:
    f.write(app_code)
