import { useEditorStore } from '@/store/editorStore';

export function serializeProjectData(state: any) {
  // Clean up blob URLs since they are session-specific
  const cleanMediaLibrary = state.mediaLibrary.map((item: any) => ({
    ...item,
    url: item.type === 'text' || item.type === 'fx' ? '' : 'PENDING_RESTORE',
    thumbnail: item.thumbnail ? 'PENDING_RESTORE' : undefined,
    frameStrip: item.frameStrip ? item.frameStrip.map(() => 'PENDING_RESTORE') : undefined,
  }));

  const projectData = {
    version: '1.1.0',
    tracks: state.tracks,
    mediaLibrary: cleanMediaLibrary,
    currentTime: state.currentTime,
    aspectRatio: state.aspectRatio,
    volume: state.volume,
    isMuted: state.isMuted,
    inPoint: state.inPoint,
    outPoint: state.outPoint,
    zoomLevel: state.zoomLevel,
    settings: state.settings,
    pipWindows: state.pipWindows,
    timelineStack: state.timelineStack,
  };

  return JSON.stringify(projectData, null, 2);
}

export function loadProjectData(data: any) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid project file: not a valid JSON object.');
  }
  if (!Array.isArray(data.tracks)) {
    throw new Error('Invalid project file: missing or invalid "tracks" array.');
  }
  if (!Array.isArray(data.mediaLibrary)) {
    throw new Error('Invalid project file: missing or invalid "mediaLibrary" array.');
  }

  const loadedTracks = data.tracks;

  useEditorStore.setState({
    tracks: loadedTracks,
    mediaLibrary: data.mediaLibrary,
    currentTime: typeof data.currentTime === 'number' ? data.currentTime : 0,
    aspectRatio: data.aspectRatio || '16:9',
    volume: typeof data.volume === 'number' ? data.volume : 1,
    isMuted: typeof data.isMuted === 'boolean' ? data.isMuted : false,
    inPoint: typeof data.inPoint === 'number' ? data.inPoint : null,
    outPoint: typeof data.outPoint === 'number' ? data.outPoint : null,
    zoomLevel: typeof data.zoomLevel === 'number' ? data.zoomLevel : 100,
    ...(data.settings ? { settings: { ...useEditorStore.getState().settings, ...data.settings } } : {}),
    ...(data.pipWindows ? { pipWindows: data.pipWindows } : {}),
    ...(data.timelineStack ? { timelineStack: data.timelineStack } : {}),
    history: [
      {
        tracks: JSON.parse(JSON.stringify(loadedTracks)),
        currentTime: typeof data.currentTime === 'number' ? data.currentTime : 0,
      }
    ],
    historyIndex: 0,
  });

  useEditorStore.getState().recalcTotalDuration();
}

/**
 * Prompt user for a new file save location.
 */
export async function saveProjectAs(): Promise<any> {
  const state = useEditorStore.getState();
  const fileContent = serializeProjectData(state);

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `project_${Date.now()}.procut`,
        types: [{
          description: 'ProCut Project File',
          accept: { 'application/x-procut': ['.procut'] },
        }],
      });
      await saveProjectToHandle(handle, fileContent);
      return handle;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Save Project As failed', err);
        fallbackDownload(fileContent);
      }
      return null;
    }
  } else {
    fallbackDownload(fileContent);
    return null;
  }
}

/**
 * Overwrite an existing file handle.
 */
export async function saveProjectToHandle(handle: any, fileContent: string) {
  try {
    const writable = await handle.createWritable();
    await writable.write(fileContent);
    await writable.close();
  } catch (err: any) {
    // If permission was denied, we might need to request it
    if (err.name === 'NotAllowedError') {
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        const writable = await handle.createWritable();
        await writable.write(fileContent);
        await writable.close();
      } else {
        throw new Error('Permission to write to file was denied.');
      }
    } else {
      throw err;
    }
  }
}

/**
 * Fallback mechanism for browsers that don't support File System Access API
 */
function fallbackDownload(fileContent: string) {
  const blob = new Blob([fileContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `project_${Date.now()}.procut`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Open a project file using the native file picker.
 */
export async function openProjectFile(): Promise<any> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'ProCut Project File',
          accept: { 'application/x-procut': ['.procut'] },
        }],
        multiple: false
      });
      const file = await handle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      loadProjectData(data);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Project loaded! Please re-import local media files to relink them.', type: 'success' }}));
      return handle;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Open Project failed', err);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to parse project file. The file may be corrupted.', type: 'error' }}));
      }
      return null;
    }
  } else {
    // Fallback handled by traditional <input type="file">
    return null;
  }
}
