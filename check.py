import re
data = open('d:/Video-Editor/src/utils/kenneyAssets.ts').read()
matches = re.finditer(r'"([a-zA-Z]+_[0-9]+)":', data)
prefixes = set(m.group(1).split('_')[0] for m in matches)
print(prefixes)
