import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { exec } from "child_process"
import fs from "fs"
import WebSocket from "ws"
import crypto from "crypto"

// Microsoft Edge TTS anti-abuse token generator
function generateSecMSGec() {
  const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  let ticks = Math.floor(Date.now() / 1000) + 11644473600;
  ticks -= ticks % 300;
  ticks *= 10000000;
  const stringToHash = `${ticks}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash("sha256").update(stringToHash, "ascii").digest("hex").toUpperCase();
}

// XML escaping helper to prevent SSML parsing failures on special characters
function escapeXml(unsafe: string): string {
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

// Custom Vite plugin to handle local AI Audio Separation
const audioSeparatorPlugin = () => ({
  name: 'audio-separator-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url && req.url.startsWith('/api/separate-audio') && req.method === 'POST') {
        try {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const originalName = urlObj.searchParams.get('name') || 'audio';
          const cleanName = originalName.replace(/[^a-zA-Z0-9_-]/g, '_');
          const timestamp = Date.now();
          const tempDir = path.resolve(__dirname, 'public/separated');
          
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }

          const tempInputPath = path.join(tempDir, `input_${timestamp}.wav`);

          // Read the binary stream of the uploaded audio file
          const chunks: any[] = [];
          req.on('data', (chunk: any) => {
            chunks.push(chunk);
          });

          req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            fs.writeFileSync(tempInputPath, buffer);

            // Execute local AI vocal separation using uvx audio-separator
            const command = `uvx audio-separator "${tempInputPath}" --output_dir "${tempDir}" --output_format=WAV`;
            
            exec(command, (error, stdout, stderr) => {
              // Delete the temporary input file to save space
              try {
                if (fs.existsSync(tempInputPath)) {
                  fs.unlinkSync(tempInputPath);
                }
              } catch (e) {
                console.warn('Failed to delete temp input:', e);
              }

              if (error) {
                console.error('[Audio Separator] Error running CLI:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
                return;
              }

              // Scan output directory for the generated files matching input_[timestamp]
              const files = fs.readdirSync(tempDir);
              const vocalsFile = files.find(f => f.startsWith(`input_${timestamp}`) && f.includes('Vocals'));
              const instFile = files.find(f => f.startsWith(`input_${timestamp}`) && f.includes('Instrumental'));

              if (!vocalsFile || !instFile) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Separated files not found in output directory.' }));
                return;
              }

              // Respond with the URLs of the separated files
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                vocalsUrl: `/separated/${vocalsFile}`,
                instrumentsUrl: `/separated/${instFile}`,
                vocalsName: `${cleanName}_Vocals.wav`,
                instrumentsName: `${cleanName}_Instrumental.wav`
              }));
            });
          });
          return;
        } catch (err: any) {
          console.error('[Audio Separator] Middleware error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
          return;
        }
      } else if (req.url && req.url.startsWith('/api/tts')) {
        try {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const text = urlObj.searchParams.get('text') || '';
          const voice = urlObj.searchParams.get('voice') || 'en-US-AriaNeural';
          const rateMultiplier = parseFloat(urlObj.searchParams.get('rate') || '1.0');
          const pitchMultiplier = parseFloat(urlObj.searchParams.get('pitch') || '1.0');

          if (!text.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Text parameter is required' }));
            return;
          }

          // Escape text for XML/SSML compatibility
          const escapedText = escapeXml(text);

          // Convert rate multiplier to percentage offset (e.g. 1.0 -> +0%, 1.2 -> +20%, 0.8 -> -20%)
          const ratePercent = Math.round((rateMultiplier - 1) * 100);
          const rateSign = ratePercent >= 0 ? '+' : '';
          const rateStr = `${rateSign}${ratePercent}%`;

          // Convert pitch multiplier to percentage offset
          const pitchPercent = Math.round((pitchMultiplier - 1) * 100);
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

          // Close WebSocket if the client disconnects/aborts the request to prevent memory leaks
          req.on('close', () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              ws.close();
            }
          });

          const audioChunks: Uint8Array[] = [];

          ws.on('open', () => {
            // Send config
            const configMsg = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
            ws.send(configMsg);

            // Send SSML
            const requestId = crypto.randomUUID().replace(/-/g, "").toLowerCase();
            const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}"><prosody pitch="${pitchStr}" rate="${rateStr}">${escapedText}</prosody></voice></speak>`;
            ws.send(ssmlMsg);
          });

          ws.on('message', (data: any, isBinary: boolean) => {
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
                audioChunks.push(new Uint8Array(audioChunk));
              }
            }
          });

          ws.on('close', () => {
            if (res.headersSent) return;

            if (audioChunks.length > 0) {
              // Concatenate chunks
              const totalLen = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
              const combined = new Uint8Array(totalLen);
              let offset = 0;
              for (const chunk of audioChunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
              }

              res.writeHead(200, {
                'Content-Type': 'audio/mp3',
                'Content-Length': combined.length,
                'Cache-Control': 'public, max-age=31536000'
              });
              res.end(Buffer.from(combined));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to synthesize speech (no audio received)' }));
            }
          });

          ws.on('error', (err: any) => {
            console.error('[Edge TTS Proxy] WebSocket error:', err);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `WebSocket error: ${err.message}` }));
            }
          });

          return;
        } catch (err: any) {
          console.error('[Edge TTS Proxy] Middleware error:', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }
      } else if (req.url && req.url.startsWith('/api/huggingface')) {
        try {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const model = urlObj.searchParams.get('model') || 'cvssp/audioldm2';
          
          const envKey = process.env.VITE_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
          const authHeader = req.headers.authorization;
          
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (envKey) {
            headers['Authorization'] = `Bearer ${envKey}`;
          } else if (authHeader) {
            headers['Authorization'] = authHeader;
          }

          const chunks: any[] = [];
          req.on('data', (chunk: any) => {
            chunks.push(chunk);
          });

          req.on('end', async () => {
            try {
              const bodyBuffer = Buffer.concat(chunks);
              const targetUrl = `https://api-inference.huggingface.co/models/${model}`;
              
              const hfRes = await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: bodyBuffer
              });

              res.writeHead(hfRes.status, {
                'Content-Type': hfRes.headers.get('content-type') || 'application/json'
              });

              const arrayBuffer = await hfRes.arrayBuffer();
              res.end(Buffer.from(arrayBuffer));
            } catch (err: any) {
              console.error('[HuggingFace Proxy Dev] fetch error:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        } catch (err: any) {
          console.error('[HuggingFace Proxy Dev] Middleware error:', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: {
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
    'import.meta.env.VITE_GROQ_API_KEY': JSON.stringify(process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || ''),
  },
  plugins: [react(), audioSeparatorPlugin()],
  server: {
    port: 3000,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@openreel/core": path.resolve(__dirname, "./packages/core/src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-icons': ['lucide-react'],
          'vendor-ai': ['onnxruntime-web', '@gradio/client', '@imgly/background-removal', 'demucs-web'],
          'vendor-media': ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'mp4-muxer'],
          'vendor-charts': ['recharts'],
          'vendor-ui': [
            '@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar', '@radix-ui/react-checkbox', '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card', '@radix-ui/react-label', '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu', '@radix-ui/react-popover', '@radix-ui/react-progress',
            '@radix-ui/react-radio-group', '@radix-ui/react-scroll-area', '@radix-ui/react-select',
            '@radix-ui/react-separator', '@radix-ui/react-slider', '@radix-ui/react-slot',
            '@radix-ui/react-switch', '@radix-ui/react-tabs', '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group', '@radix-ui/react-tooltip', 'cmdk', 'vaul', 'sonner', 'embla-carousel-react'
          ],
          'vendor-core': ['react', 'react-dom', 'react-router', 'zustand', 'zod', 'react-hook-form', 'date-fns'],
        },
      },
    },
  },
});
