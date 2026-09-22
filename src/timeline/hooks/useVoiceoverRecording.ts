import { useState, useRef, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { extractWaveformFromUrl } from '@/utils/mediaProbe';

export function useVoiceoverRecording() {
  const {
    isRecordingVoiceover,
    recordingTrackId,
    startVoiceoverRecordingState,
    stopVoiceoverRecordingState,
    play,
    pause,
    addClip,
  } = useEditorStore(useShallow(s => ({
    isRecordingVoiceover: s.isRecordingVoiceover,
    recordingTrackId: s.recordingTrackId,
    startVoiceoverRecordingState: s.startVoiceoverRecordingState,
    stopVoiceoverRecordingState: s.stopVoiceoverRecordingState,
    play: s.play,
    pause: s.pause,
    addClip: s.addClip,
  })));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartPlayheadRef = useRef<number>(0);
  const recordingStartTimeMsRef = useRef<number>(0);

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleVoiceoverRecordingToggle = useCallback(async (trackId: string) => {
    const isRecordingThis = isRecordingVoiceover && recordingTrackId === trackId;

    if (isRecordingVoiceover && !isRecordingThis) {
      return;
    }

    if (!isRecordingVoiceover) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          toast.error('Microphone access is unavailable in this context (requires a secure HTTPS context).');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        audioChunksRef.current = [];

        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        // P1 FIX: A mid-recording recorder error silently flips state to 'inactive',
        // which skips the onstop path — the mic stays hot and the red recording
        // banner stays stuck forever. Recover fully here instead.
        recorder.onerror = () => {
          if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((t) => t.stop());
            audioStreamRef.current = null;
          }
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
          stopVoiceoverRecordingState();
          toast.error('Voiceover recording failed. Recording stopped.');
        };

        recorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          audioChunksRef.current = [];
          if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
          const elapsed = (Date.now() - recordingStartTimeMsRef.current) / 1000;
          const audioUrl = URL.createObjectURL(blob);

          // Fix timing drift by probing exact decoded duration with WebM Infinity workaround
          const probedDuration = await new Promise<number>((resolve) => {
            const audio = new Audio(audioUrl);
            const timer = setTimeout(() => resolve(elapsed), 1500);
            audio.onloadedmetadata = () => {
              if (audio.duration === Infinity) {
                audio.currentTime = 1e101;
                audio.ontimeupdate = () => {
                  audio.ontimeupdate = null;
                  clearTimeout(timer);
                  resolve(isFinite(audio.duration) && audio.duration > 0 ? audio.duration : elapsed);
                };
              } else {
                clearTimeout(timer);
                resolve(isFinite(audio.duration) && audio.duration > 0 ? audio.duration : elapsed);
              }
            };
            audio.onerror = () => {
              clearTimeout(timer);
              resolve(elapsed);
            };
          });

          const finalDuration = Math.max(0.5, Number(probedDuration.toFixed(2)));
          const mediaId = `recorded_voiceover_${Date.now()}`;

          let peaks: number[] = [];
          try {
            peaks = await extractWaveformFromUrl(audioUrl);
          } catch {
            peaks = Array.from({ length: 200 }, () => 0);
          }

          try {
            await useEditorStore.getState().addMedia({
              id: mediaId,
              name: `Voiceover Recording`,
              type: 'audio',
              duration: finalDuration,
              url: audioUrl,
              createdAt: Date.now(),
              waveformPeaks: peaks,
            }, new File([blob], `voiceover_${mediaId}.webm`, { type: mimeType }));
          } catch (err) {
            console.error('Failed to add voiceover media item:', err);
            useEditorStore.getState().addMedia({
              id: mediaId,
              name: `Voiceover Recording`,
              type: 'audio',
              duration: finalDuration,
              url: audioUrl,
              createdAt: Date.now(),
              waveformPeaks: peaks,
            });
          }

          const clipId = `clip_recorded_${Math.random().toString(36).substr(2, 9)}`;
          const newClip = {
            id: clipId,
            mediaId,
            trackId,
            startTime: recordingStartPlayheadRef.current,
            duration: finalDuration,
            trimStart: 0,
            trimEnd: 0,
            transform: { x: 0, y: 0, scale: 100, rotation: 0 },
            opacity: 1,
            speed: 1,
            effects: [],
          };

          addClip(newClip);

          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((t) => t.stop());
            audioStreamRef.current = null;
          }

          stopVoiceoverRecordingState();
          useEditorStore.getState().saveSnapshot('Record Voiceover');
        };

        setRecordingSeconds(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds(Math.floor((Date.now() - recordingStartTimeMsRef.current) / 1000));
        }, 1000);

        recorder.start();
        recordingStartPlayheadRef.current = useEditorStore.getState().currentTime;
        recordingStartTimeMsRef.current = Date.now();
        startVoiceoverRecordingState(trackId);
        play();
      } catch (err) {
        console.error('Microphone access denied or voiceover recording failed:', err);
        // P1 FIX: If the mic was acquired but MediaRecorder construction/start threw,
        // stop the stream tracks here — otherwise the microphone stays hot until
        // unmount and the recording timer keeps ticking.
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        toast.error('Failed to access microphone. Please check your system/browser permissions.');
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      pause();

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [
    isRecordingVoiceover,
    recordingTrackId,
    startVoiceoverRecordingState,
    stopVoiceoverRecordingState,
    play,
    pause,
    addClip
  ]);

  useEffect(() => {
    return () => {
      // Clear interval first
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn('Error stopping MediaRecorder:', e);
        }
      }
      
      // Stop all audio tracks
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {
            console.warn('Error stopping track:', e);
          }
        });
        audioStreamRef.current = null;
      }
    };
  }, []);

  return {
    handleVoiceoverRecordingToggle,
    recordingSeconds,
    isRecordingVoiceover,
    recordingTrackId,
  };
}
