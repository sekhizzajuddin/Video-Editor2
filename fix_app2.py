import re

with open('src/mobile/App.tsx', 'r', encoding='utf8') as f:
    app_code = f.read()
    
app_code = app_code.replace(
    "import { MobilePropertiesSheet } from './components/MobilePropertiesSheet';",
    "import { PropertiesPanel } from '@/components/properties/PropertiesPanel';"
)

app_code = app_code.replace(
    "<MobilePropertiesSheet category={activePropertyTab as any} onClose={() => setSheet('none')} />",
    "<PropertiesPanel isMobileView={true} mobileCategory={activePropertyTab as any} onMobileClose={() => setSheet('none')} />"
)

with open('src/mobile/App.tsx', 'w', encoding='utf8') as f:
    f.write(app_code)

