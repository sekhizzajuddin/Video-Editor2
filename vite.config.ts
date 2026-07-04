import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { exec } from "child_process"
import fs from "fs"

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
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), audioSeparatorPlugin()],
  server: {
    port: 3000,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@openreel/core": path.resolve(__dirname, "./packages/core/src"),
    },
  },
});
