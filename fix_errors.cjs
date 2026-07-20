const fs = require('fs');

// 1. PreviewCanvas.tsx
let previewCanvas = fs.readFileSync('d:/Video-Editor/src/components/PreviewCanvas.tsx', 'utf8');
previewCanvas = previewCanvas.replace('const tick = (now) => {', 'const tick = (now: number) => {');
fs.writeFileSync('d:/Video-Editor/src/components/PreviewCanvas.tsx', previewCanvas);

// 2. SequenceProperties.tsx
let seqProps = fs.readFileSync('d:/Video-Editor/src/components/properties/SequenceProperties.tsx', 'utf8');
seqProps = seqProps.replace(/transitionType === 'none'/g, "transitionType === 'crossfade'");
fs.writeFileSync('d:/Video-Editor/src/components/properties/SequenceProperties.tsx', seqProps);

// 3. editorStore.ts
let editorStore = fs.readFileSync('d:/Video-Editor/src/store/editorStore.ts', 'utf8');
editorStore = editorStore.replace(/pipWindows: \{\},\n/g, "pipWindows: {},\n    sequences: [],\n");
editorStore = editorStore.replace(/let memberClipIds;/g, "let memberClipIds: string[] = [];");
fs.writeFileSync('d:/Video-Editor/src/store/editorStore.ts', editorStore);

// 4. WorkflowExecutor.ts
let workflowExec = fs.readFileSync('d:/Video-Editor/src/utils/ai-copilot/WorkflowExecutor.ts', 'utf8');
workflowExec = workflowExec.replace(/const result = executeAITool\(step\.toolName, finalArgs, ctx\.conversation\);/g, "const result = executeAITool(step.toolName, finalArgs);");
fs.writeFileSync('d:/Video-Editor/src/utils/ai-copilot/WorkflowExecutor.ts', workflowExec);

// 5. imageSequence.ts
let imageSeq = fs.readFileSync('d:/Video-Editor/src/utils/sequencer/imageSequence.ts', 'utf8');
imageSeq = imageSeq.replace(/const sequence: ImageSequence = \{/g, "const sequence: ImageSequence = {\n    totalDuration: clips.length * defaultClipDuration - Math.max(0, clips.length - 1) * overlap,");
fs.writeFileSync('d:/Video-Editor/src/utils/sequencer/imageSequence.ts', imageSeq);

console.log('Patched all TS errors');
