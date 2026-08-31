import re

file_path = "d:/Video-Editor/src/hooks/useMediaPlayback.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the lazy init block to deduplicate the audio graph per HTMLMediaElement.
lazy_init_block = """        // Lazy init audio graph
        if ((entry.type === 'audio' || entry.type === 'video') && !entry.sourceNode) {
          initAudioGraph(entry);
        }"""

new_lazy_init_block = """        // Lazy init audio graph
        if ((entry.type === 'audio' || entry.type === 'video') && !entry.sourceNode) {
          const el = entry.el as any;
          if (el._procutSharedAudioGraph) {
            Object.assign(entry, el._procutSharedAudioGraph);
          } else {
            initAudioGraph(entry);
            if (entry.sourceNode) {
              el._procutSharedAudioGraph = {
                audioCtx: entry.audioCtx,
                feedbackInputGain: entry.feedbackInputGain,
                feedbackNode: entry.feedbackNode,
                pannerNode: entry.pannerNode,
                gainNode: entry.gainNode,
                separationGraph: entry.separationGraph,
                sourceNode: entry.sourceNode,
                vocalFilter: entry.vocalFilter,
                pitchNode: entry.pitchNode,
                compressorNode: entry.compressorNode,
                denoiseFilter: entry.denoiseFilter,
                bassFilter: entry.bassFilter,
                midFilter: entry.midFilter,
                trebleFilter: entry.trebleFilter,
                deEsserFilter: entry.deEsserFilter,
                warmthFilter: entry.warmthFilter,
                delayNode: entry.delayNode,
                delayGain: entry.delayGain,
              };
            }
          }
        }"""

if lazy_init_block in content:
    content = content.replace(lazy_init_block, new_lazy_init_block)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched successfully!")
else:
    print("Could not find the target block.")