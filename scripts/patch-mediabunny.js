import fs from 'fs';
import path from 'path';

const filesToPatch = [
  'node_modules/mediabunny/dist/bundles/mediabunny.mjs',
  'node_modules/mediabunny/dist/bundles/mediabunny.node.cjs',
  'node_modules/mediabunny/dist/modules/src/media-sink.js',
  'node_modules/mediabunny/src/media-sink.ts',
];

for (const relPath of filesToPatch) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  // Replace this.decoder.close();
  const pattern1 = /this\.decoder\.close\(\);/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, 'try { if (this.decoder && this.decoder.state !== "closed") this.decoder.close(); } catch (_) {}');
    modified = true;
  }

  // Replace this.alphaDecoder?.close();
  const pattern2 = /this\.alphaDecoder\?\.close\(\);/g;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, 'try { if (this.alphaDecoder && this.alphaDecoder.state !== "closed") this.alphaDecoder.close(); } catch (_) {}');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`[patch-mediabunny] Successfully patched ${relPath}`);
  }
}
