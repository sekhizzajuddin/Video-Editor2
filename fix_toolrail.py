import re
with open('src/mobile/components/MobileToolRail.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# Remove specific <Tool ... /> lines from MobileToolRail.tsx
to_remove = [
    r'<Tool icon={<Scissors className="h-4 w-4" />} label="Split" onClick={handleSplit} />\n\s*',
    r'<Tool icon={<Gauge className="h-4 w-4 text-purple-400" />} label="Rate Stretch" onClick={\(\) => onOpenProperties\(\'speed\'\)} />\n\s*',
    r'<Tool\s*icon={<Copy className="h-4 w-4" />}.*?/>\n\s*',
    r'<Tool\s*icon={<ClipboardPaste className="h-4 w-4" />}.*?/>\n\s*',
    r'<Tool icon={<CopyPlus className="h-4 w-4" />} label="Duplicate" onClick={handleDuplicate} />\n\s*',
    r'<Tool icon={<Trash2 className="h-4 w-4 text-rose-400" />} label="Delete" onClick={handleDelete} />\n\s*'
]

for pat in to_remove:
    code = re.sub(pat, '', code, flags=re.DOTALL)

with open('src/mobile/components/MobileToolRail.tsx', 'w', encoding='utf8') as f:
    f.write(code)
