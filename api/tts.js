import WebSocket from 'ws';
import crypto from 'crypto';

function generateSecMSGec() {
  const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  const WINDOWS_FILE_TIME_EPOCH = 11644473600n;
  const ticks = BigInt(Math.floor(Date.now() / 1000) + Number(WINDOWS_FILE_TIME_EPOCH)) * 10000000n;
  const roundedTicks = ticks - (ticks % 3000000000n);
  const stringToHash = `${roundedTicks}${TRUSTED_CLIENT_TOKEN}`;
  
  return crypto.createHash("sha256").update(stringToHash, "ascii").digest("hex").toUpperCase();
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { text, voice = 'en-US-AriaNeural', rate = '1.0', pitch = '1.0' } = req.query;

  if (!text || !text.trim()) {
    res.status(400).json({ error: 'Text parameter is required' });
    return;
  }

  try {
    const escapedText = escapeXml(text);
    
    // Rate multiplier to percent string
    const ratePercent = Math.round((parseFloat(rate) - 1) * 100);
    const rateSign = ratePercent >= 0 ? '+' : '';
    const rateStr = `${rateSign}${ratePercent}%`;

    // Pitch multiplier to percent string
    const pitchPercent = Math.round((parseFloat(pitch) - 1) * 100);
    const pitchSign = pitchPercent >= 0 ? '+' : '';
    const pitchStr = `${pitchSign}${pitchPercent}%`;

    const gec = generateSecMSGec();
    const connectionId = crypto.randomUUID().replace(/-/g, "").toUpperCase();
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connectionId}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-143.0.3650.75`;

    const ws = new WebSocket(wsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold"
      }
    });

    const audioChunks = [];

    // Setup connection-abort hook to close WS
    req.on('close', () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    });

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        const configMsg = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
        ws.send(configMsg);

        const requestId = crypto.randomUUID().replace(/-/g, "").toLowerCase();
        const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}"><prosody pitch="${pitchStr}" rate="${rateStr}">${escapedText}</prosody></voice></speak>`;
        ws.send(ssmlMsg);
      });

      ws.on('message', (data, isBinary) => {
        if (!isBinary) {
          const textMsg = data.toString();
          if (textMsg.includes('Path:turn.end')) {
            ws.close();
          }
        } else {
          const headerLength = data.readUInt16BE(0);
          const headerText = data.toString('utf8', 2, 2 + headerLength);
          if (headerText.includes('Path:audio')) {
            const audioChunk = data.subarray(2 + headerLength);
            audioChunks.push(Buffer.from(audioChunk));
          }
        }
      });

      ws.on('close', () => {
        resolve();
      });

      ws.on('error', (err) => {
        reject(err);
      });
    });

    if (audioChunks.length > 0) {
      const combined = Buffer.concat(audioChunks);
      res.setHeader('Content-Type', 'audio/mp3');
      res.setHeader('Content-Length', combined.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.status(200).send(combined);
    } else {
      res.status(500).json({ error: 'Failed to synthesize speech (no audio received)' });
    }
  } catch (err) {
    console.error('[Vercel Edge TTS] error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}
