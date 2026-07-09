const WebSocket = require('ws');

const geminiKey = 'AQ.Ab8RN6JwMTF_L0nRG4MnB3RrPXRCoZt1XTV3k3tPZlyKBh-XOQ';
const HOST = 'generativelanguage.googleapis.com';
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

const url = `${WS_URL}?key=${geminiKey}`;
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('WebSocket connected.');
  
  const setupMsg = {
    setup: {
      model: 'models/gemini-2.5-flash',
      generationConfig: {
        responseModalities: ["AUDIO", "TEXT"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede'
            }
          }
        }
      }
    }
  };
  ws.send(JSON.stringify(setupMsg));
});

let setupComplete = false;

ws.on('message', (data) => {
  const jsonStr = data.toString();
  try {
    const msg = JSON.parse(jsonStr);
    if (msg.setupComplete) {
      console.log('Setup complete, sending text...');
      setupComplete = true;
      const turnMsg = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: 'Hello, this is a test of the TTS system.' }]
            }
          ],
          turnComplete: true
        }
      };
      ws.send(JSON.stringify(turnMsg));
    } else if (msg.serverContent) {
      if (msg.serverContent.modelTurn && msg.serverContent.modelTurn.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.text) {
            console.log('Received text:', part.text);
          }
          if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
            console.log('Received audio data block of length:', part.inlineData.data.length);
          }
        }
      }
      if (msg.serverContent.turnComplete) {
        console.log('Turn complete. Closing.');
        ws.close();
      }
    }
  } catch (e) {
    console.error('Error parsing message', e);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket Error:', err);
});

ws.on('close', () => {
  console.log('WebSocket connection closed.');
});
