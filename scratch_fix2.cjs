const fs = require('fs');
let content = fs.readFileSync('src/utils/aiClient.ts', 'utf8');

// Fix 1: join('\n') that broke into two lines
content = content.replace(/\.join\('\n'\)\}/g, ".join('\\n')}");

// Fix 2: start: <number>
content = content.replace(/"start": <number>,/g, '"start": "<number>",');
content = content.replace(/"end": <number>,/g, '"end": "<number>",');

// Fix 3: image_url: { url: `data:image/jpeg;base64,${stripDataUri(frame)}` } -> if it broke
content = content.replace(/image_url: \{ url: `data:image\/jpeg;base64,\$\{stripDataUri\(frame\)\}` \}/g, "image_url: { url: `data:image/jpeg;base64,\\${stripDataUri(frame)}` }");

// What about line 811?
// requestHeaders['Authorization'] = `Bearer ${key}`;
content = content.replace(/requestHeaders\['Authorization'\] = `Bearer \$\{key\}`;/g, "requestHeaders['Authorization'] = `Bearer \\${key}`;");

// And line 814
// return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${key}`;
content = content.replace(/return `https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/\$\{GEMINI_VISION_MODEL\}:generateContent\?key=\$\{key\}`;/g, "return `https://generativelanguage.googleapis.com/v1beta/models/\\${GEMINI_VISION_MODEL}:generateContent?key=\\${key}`;");

// And line 825 (was errorText ...)
content = content.replace(/throw new Error\(`\[\$\{provider\.toUpperCase\(\)\} API Error\] \$\{response\.status\} - \$\{errorText\}`\);/g, "throw new Error(`[\\${provider.toUpperCase()} API Error] \\${response.status} - \\${errorText}`);");

// And line 836
content = content.replace(/throw new Error\(`Failed to parse \$\{provider\.toUpperCase\(\)\} response: \$\{text\.substring\(0, 200\)\}`\);/g, "throw new Error(`Failed to parse \\${provider.toUpperCase()} response: \\${text.substring(0, 200)}`);");

// And line 842:
content = content.replace(/const response = await fetch\(`https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent\?key=\$\{apiKey\}`/g, "const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\\${apiKey}`");

// And line 846:
content = content.replace(/contents: \[\{ role: "user", parts: \[\{ text: `\$\{systemPrompt\}\n\nUser Prompt: \$\{prompt\}` \}\] \}\]/g, "contents: [{ role: \"user\", parts: [{ text: `\\${systemPrompt}\\n\\nUser Prompt: \\${prompt}` }] }]");

// And line 858:
content = content.replace(/total audio voiceover duration of \$\{totalDuration\.toFixed\(1\)\} seconds\./g, "total audio voiceover duration of \\${totalDuration.toFixed(1)} seconds.");
content = content.replace(/MUST equal exactly \$\{totalDuration\.toFixed\(1\)\} seconds\./g, "MUST equal exactly \\${totalDuration.toFixed(1)} seconds.");

// And line 872:
content = content.replace(/fetch\(`https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent\?key=\$\{apiKey\}`/g, "fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\\${apiKey}`");

// And line 876:
content = content.replace(/contents: \[\{ role: "user", parts: \[\{ text: `\$\{systemPrompt\}\n\nScript: \$\{script\}` \}\] \}\]/g, "contents: [{ role: \"user\", parts: [{ text: `\\${systemPrompt}\\n\\nScript: \\${script}` }] }]");

// And line 884:
content = content.replace(/throw new Error\(`Failed to generate scenes: \$\{err\}`\);/g, "throw new Error(`Failed to generate scenes: \\${err}`);");

fs.writeFileSync('src/utils/aiClient.ts', content);
console.log('Fixed');
