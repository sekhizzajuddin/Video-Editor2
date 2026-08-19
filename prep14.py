import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    mobile_code = f.read()

mobile_code = mobile_code.replace("const trackingResults: any[] = [];\n", "")

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(mobile_code)
