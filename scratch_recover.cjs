const fs = require('fs');

const content = fs.readFileSync('src/utils/aiClient.ts', 'utf8');
const lines = content.split('\n');

const line1 = lines[0];

// The appendix starts right after the giant string in line 1
// The appendix begins with `  const response = await fetchWithKeyFailover(`
// But wait, the giant string and appendix were concatenated like:
// newLines.join('\\n') + "\n  const response = await fetchWithKeyFailover("
// So the giant string is EXACTLY what is before the first actual newline.
const giantString = line1;
const originalLines = giantString.split('\\n');

console.log('Original lines count after split:', originalLines.length);

// We know we want exactly 805 lines.
if (originalLines.length >= 805) {
  // Let's just join them with real newline.
  const restoredTop = originalLines.join('\n');
  
  // The rest of the file is lines[1] to end
  const restOfFile = lines.slice(1).join('\n');
  
  fs.writeFileSync('src/utils/aiClient.ts', restoredTop + '\n' + restOfFile);
  console.log('Recovery successful!');
} else {
  console.log('Something went wrong, got', originalLines.length);
}
