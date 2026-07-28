import { useEditorStore } from '../store/editorStore';

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let lastExecTime = 0;
let lastDescription = '';

/**
 * Schedules an undo history snapshot with leading-edge capture and trailing debounce (300ms).
 * Prevents undo stack flooding during high-frequency continuous slider drags (Issue 6).
 *
 * @param description Description of the operation for history logs
 * @param cooldownMs Debounce interval in milliseconds (default 300ms)
 */
export function scheduleSaveSnapshot(description = 'Update property', cooldownMs = 300): void {
  const now = performance.now();
  const timeSinceLast = now - lastExecTime;
  const store = useEditorStore.getState();

  lastDescription = description;

  // Leading edge: if sufficient time has elapsed since last snapshot, save immediately
  if (timeSinceLast >= cooldownMs) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    store.saveSnapshot(description);
    lastExecTime = now;
    return;
  }

  // Trailing debounce: delay trailing snapshot until continuous drag ends or halts
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
  }

  timeoutId = setTimeout(() => {
    store.saveSnapshot(lastDescription);
    lastExecTime = performance.now();
    timeoutId = null;
  }, cooldownMs);
}
