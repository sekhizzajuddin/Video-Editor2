import fs from 'fs';
import path from 'path';

const filesToPatch = [
  'node_modules/mediabunny/dist/bundles/mediabunny.mjs',
  'node_modules/mediabunny/dist/bundles/mediabunny.node.cjs',
  'node_modules/mediabunny/dist/modules/src/media-sink.js',
  'node_modules/mediabunny/dist/modules/src/input-track.js',
  'node_modules/mediabunny/src/media-sink.ts',
  'node_modules/mediabunny/src/input-track.ts',
];

for (const relPath of filesToPatch) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  // Fix 1: Replace this.decoder.close();
  const pattern1 = /this\.decoder\.close\(\);/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, 'try { if (this.decoder && this.decoder.state !== "closed") this.decoder.close(); } catch (_) {}');
    modified = true;
  }

  // Fix 2: Replace this.alphaDecoder?.close();
  const pattern2 = /this\.alphaDecoder\?\.close\(\);/g;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, 'try { if (this.alphaDecoder && this.alphaDecoder.state !== "closed") this.alphaDecoder.close(); } catch (_) {}');
    modified = true;
  }

  // Fix 3: Patch VideoDecoder.isConfigSupported in canDecode method
  // This is the critical bug causing "TypeError: VideoDecoder.isConfigSupported is not a function"
  const canDecodePattern = /async canDecode\(\)\s*\{[\s\S]*?if\s*\(\s*typeof\s+VideoDecoder\s*===\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?return\s+false;[\s\S]*?\}[\s\S]*?const\s+support\s*=\s*await\s+VideoDecoder\.isConfigSupported\(decoderConfig\);[\s\S]*?return\s+support\.supported\s*===\s*true;[\s\S]*?\}/g;
  if (canDecodePattern.test(content)) {
    content = content.replace(canDecodePattern, `async canDecode() {
        try {
            const decoderConfig = await this._backing.getDecoderConfig();
            if (!decoderConfig) {
                return false;
            }
            const codec = await this._backing.getCodec();
            assert(codec !== null);
            if (customVideoDecoders.some(x => x.supports(codec, decoderConfig))) {
                return true;
            }
            if (typeof VideoDecoder === 'undefined') {
                return false;
            }
            // Fallback for environments where isConfigSupported is not available
            if (typeof VideoDecoder.isConfigSupported !== 'function') {
                Logging._warn('VideoDecoder.isConfigSupported not available, assuming support');
                return true;
            }
            const support = await VideoDecoder.isConfigSupported(decoderConfig);
            return support.supported === true;
        }
        catch (error) {
            Logging._error('Error during decodability check:', error);
            return false;
        }
    }`);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`[patch-mediabunny] Successfully patched ${relPath}`);
  }
}
