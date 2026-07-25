import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { loadProjectData } from '@/utils/fileSystemAccess';

export function FileHandlerInitializer() {
  useEffect(() => {
    if ('launchQueue' in window) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (launchParams.files && launchParams.files.length > 0) {
          const handle = launchParams.files[0];
          
          try {
            // Read the file data
            const file = await handle.getFile();
            const text = await file.text();
            const data = JSON.parse(text);

            // Load into editor store
            loadProjectData(data);
            useEditorStore.getState().setProjectFileHandle(handle);

            console.log('Project loaded from launch queue:', handle.name);
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Project ${handle.name} loaded successfully!`, type: 'success' }}));
          } catch (err) {
            console.error('Failed to load project from launch queue:', err);
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to load the selected .procut project. The file may be corrupted.', type: 'error' }}));
          }
        }
      });
    }
  }, []);

  return null; // This component doesn't render anything
}
