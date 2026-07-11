import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync('.env.local', 'utf-8');
let apiKey = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_GEMINI_API_KEY=')) {
    apiKey = line.split('=')[1].trim();
    break;
  }
}

async function testModel(modelName) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello, who are you?' }] }]
      })
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log(`\nModel ${modelName} success! Response:`, data.candidates[0].content.parts[0].text);
    } else {
      console.log(`\nModel ${modelName} failed:`, response.status, data);
    }
  } catch (error) {
    console.error(`\nModel ${modelName} error:`, error.message);
  }
}

testModel('gemini-3-flash-live');
testModel('gemini-3-flash-preview');
