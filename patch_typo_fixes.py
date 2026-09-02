with open('src/utils/kineticTypography.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix lineHeight = baseFontSize * 1.25
old_line = "const lineHeight = baseFontSize * 1.35;"
new_line = "const lineHeight = baseFontSize * 1.25;"
content = content.replace(old_line, new_line)

# Fix primaryClip.textSettings properties to prevent shadow/stroke rendering
old_primary = """          primaryClip.textSettings!.color = 'transparent';
          primaryClip.textSettings!.backgroundColor = 'rgba(0,0,0,0.8)';"""
          
new_primary = """          primaryClip.textSettings!.color = 'transparent';
          primaryClip.textSettings!.strokeWidth = 0;
          primaryClip.textSettings!.shadow = false;
          primaryClip.textSettings!.backgroundColor = 'rgba(0,0,0,0.8)';"""
          
content = content.replace(old_primary, new_primary)

with open('src/utils/kineticTypography.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched typo fixes!")
