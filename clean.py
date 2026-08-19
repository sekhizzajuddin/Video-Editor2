import os
import re

folder = 'src/mobile'

for root, _, files in os.walk(folder):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf8') as file:
                content = file.read()
            
            new_content = re.sub(r'// [^\n]*\n// \[DESKTOP SYNC\].*?// [^\n]*\n+', '', content, flags=re.DOTALL)
            
            if new_content != content:
                with open(path, 'w', encoding='utf8') as file:
                    file.write(new_content)
                print('Cleaned', path)
