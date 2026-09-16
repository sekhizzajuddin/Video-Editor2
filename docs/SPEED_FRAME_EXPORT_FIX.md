# Speed Frame: export immediately after editing

## Reported behavior

Export could crash after a Speed Frame edit, but reopening the saved project allowed export until the next edit. This points to a difference in live editor state/resources, not necessarily invalid saved speed data.

## Confirmed defects

1. **Two different playhead times.** `addSpeedFrame` and `selectSpeedFrame` wrote directly to the React-free playback clock, leaving `editorStore.currentTime` behind. The RAF media loop used the clock, while the paused-seek subscriber used the store. A browser trace after moving a marker showed the same video being sought alternately to source times **3.2s and 0s**, with clock time **4s** and store time **0s**. Clearing trim preview at drag completion also abandoned the dragged marker's final position.
2. **Unnecessary/duplicate seeks.** The paused subscriber treated every store notification (including autosave and history/UI changes) as a seek request. It added a one-shot `seeked` listener on top of the existing permanent handler. The permanent handler could reassign an already-reached pending time, starting another native seek.
3. **Preview/export decoder contention.** Worker export paused playback but did not unload the preview media pool or suspend its seek/render loops. Paused media elements still retain decoder sessions and decoded surfaces. Reloading discards these live resources and synchronizes both playheads, explaining why the saved project behaved differently.
4. **Incomplete export lifecycle cleanup.** The export manager retained the entire editor store, including history and DOM/audio references, although only timeline data was sent to the worker. Native worker errors reported an error to the UI without rejecting the export promise. A failed worker was not terminated until *after* capture fallback finished. Cancellation during media preparation could still start a worker afterward.

The Speed Frame drag actions already avoided history snapshots during pointer movement. The fix does **not** delete undo history or change Speed Frame rate/source-anchor mathematics.

## Changes

- Use the normal synchronized seek action for Speed Frame navigation; commit the final marker time before clearing trim preview and saving the single drag snapshot.
- Make paused seeking use the same effective preview time as the RAF loop. Ignore unrelated store notifications, use the existing permanent seek handler, and avoid redundant pending seeks.
- Add a scoped, synchronous preview-suspension lease for worker export. Unload each shared media element once, clear queued seeks, and stop preview loading/sync/compositing until export releases the lease.
- Keep suspension separate from `isExporting`, which is the **preview-capture** mode and must continue rendering. Restore preview before fallback and on success, cancellation, error, or unmount.
- Snapshot only export data, release retained inputs, settle native worker errors, install response listeners before posting work, and check cancellation during preparation. Dispose the failed worker before starting fallback. Forward cancellation to capture fallback as well.

The affected store, preview, playback, and export modules are shared by desktop and mobile.

## Verification

Focused regression suite: **64 tests pass**, including 26 new tests:

```sh
npx vitest run \
  src/store/speedFrameExport.test.ts \
  src/utils/previewSuspension.test.ts \
  src/export/engine/ExportWorkerManager.lifecycle.test.ts \
  src/export/useExportEngine.test.ts \
  src/export/ExportPipeline.test.ts \
  src/utils/speedRamp.test.ts \
  src/utils/dynamicStretch.test.ts \
  src/export/engine/FrameScheduler.test.ts
```

- All four new store regression cases fail against the original store and pass with the fix.
- Production TypeScript/Vite/PWA build passes.
- Real headless-browser checks exercised the actual preview, store actions, IndexedDB restore, audio mix, export worker, WebCodecs, muxer, and OPFS output:
  - Edit → export → small edit → export, without reload.
  - Screw-head move → undo/redo → export.
  - Save → reload project → export → small edit → export.
  - Outputs contain audio and have the expected stretched durations (13s / 13.2s for a generated 12s source).
  - Preview media sources are unloaded during worker export and restored at the correct source position afterward. The alternating stale-position seeks no longer occur.
- The full suite retains six **pre-existing** failures: four vocal-tone expectation failures, a stale `AssetDecoder.decodedQueue` debug assertion, and the existing fake-codec `exportManagerWiring` scenario. No new failures were introduced.

### Remaining hardware verification

The browser checks used a generated 160×90 VP8/Opus source and VP9/Opus WebM output. The sandbox browser has no H.264 encoder/GPU comparable to a user's device. The exact reported 30–40% tab crash was not reproduced here; repeat the edit/export sequence with the original footage, resolution, and browser/GPU to verify that hardware-specific case. No reload or history purge is part of the fix.
