const fs = require('fs');
const transcriptFull = fs.readFileSync('C:/Users/Sekhi/.gemini/antigravity/brain/d377afc8-7952-4670-bde7-4b08ef25d60f/.system_generated/logs/transcript_full.jsonl', 'utf8');

const lines = transcriptFull.split('\n');
const recoveredLines = {};

for (const line of lines) {
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'TOOL_RESPONSE' && obj.content && obj.content.includes('File Path: `file:///d:/Video-Editor/src/utils/aiClient.ts`')) {
      const parts = obj.content.split('The following code has been modified to include a line number before every line');
      if (parts.length > 1) {
        const codeLines = parts[1].split('\n').slice(1);
        for (const codeLine of codeLines) {
          if (codeLine.startsWith('The above content does NOT show')) break;
          const match = codeLine.match(/^(\d+): (.*)/);
          if (match) {
            recoveredLines[parseInt(match[1])] = match[2];
          } else if (codeLine.match(/^(\d+):$/) || codeLine.match(/^(\d+):\r$/)) {
             const m2 = codeLine.match(/^(\d+):/);
             recoveredLines[parseInt(m2[1])] = '';
          }
        }
      }
    }
  } catch (e) { }
}

const maxLine = Math.max(...Object.keys(recoveredLines).map(k => parseInt(k)));
console.log('Max line found:', maxLine);
console.log('Total lines recovered:', Object.keys(recoveredLines).length);

if (maxLine > 800) {
  const finalOutput = [];
  for (let i = 1; i <= maxLine; i++) {
    finalOutput.push(recoveredLines[i] !== undefined ? recoveredLines[i] : `// LINE ${i} MISSING`);
  }
  fs.writeFileSync('src/utils/aiClient.ts', finalOutput.join('\n'));
  console.log('Recovery complete!');
}
