const fs = require('fs');
const content = fs.readFileSync('src/utils/aiClient.ts.raw', 'utf8');

const lines = content.split('\n');

const cleanedLines = [];

for (const line of lines) {
  // Check if line starts with "<number>: "
  const match = line.match(/^\d+: (.*)/);
  if (match) {
    cleanedLines.push(match[1]);
  } else if (line.match(/^\d+:$/) || line.match(/^\d+:\r$/)) {
    cleanedLines.push('');
  }
}

console.log('Recovered lines count:', cleanedLines.length);

if (cleanedLines.length > 500) {
  fs.writeFileSync('src/utils/aiClient.ts.recovered', cleanedLines.join('\n'));
  console.log('Successfully saved to aiClient.ts.recovered');
} else {
  console.log('Failed to parse properly.');
}
