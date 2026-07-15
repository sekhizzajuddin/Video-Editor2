const fs = require('fs');
let c = fs.readFileSync('src/components/PropertiesPanel.tsx', 'utf8');

c = c.replace(/updateClip\(selectedClip\.id,\s*\{\s*speedRamp:[\s\S]*?\}\)/g, (match) => {
  return match.slice(0, -1) + ', { ripple: true })';
});

c = c.replace(/updateClip\(selectedClip\.id,\s*\{\s*speed:[\s\S]*?\}\)/g, (match) => {
  return match.slice(0, -1) + ', { ripple: true })';
});

fs.writeFileSync('src/components/PropertiesPanel.tsx', c);
