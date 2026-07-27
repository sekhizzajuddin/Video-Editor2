
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useEditorStore } from '@/store/editorStore';

import { saveFileToDB } from '@/utils/projectPersistence';
import { probeFile } from '@/utils/mediaProbe';
import { v4 as uuidv4 } from 'uuid';

export function useTTS(setActiveMediaTab?: any) {
  const addMedia = useEditorStore(state => state.addMedia);
  const [ttsText, setTtsText] = useState('');
const [ttsLanguage, setTtsLanguage] = useState('en');
const [ttsRate, setTtsRate] = useState(1);
const [ttsPitch, setTtsPitch] = useState(1);
const [ttsEngine, setTtsEngine] = useState<'standard' | 'neural' | 'edge' | 'gemini'>('edge');
const [ttsVoice, setTtsVoice] = useState('en-US-AriaNeural');
const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
const previewTTS = async () => {
    if (!ttsText.trim()) return;

    if (ttsEngine === 'gemini') {
      try {
        setIsGeneratingTTS(true);
        const { GeminiLiveClient } = await import('@/utils/geminiLiveClient');
        const client = new GeminiLiveClient();
        
        let previewChunks: Int16Array[] = [];
        
        client.onAudioData = (pcmData) => {
          previewChunks.push(pcmData);
        };
        
        client.onTurnComplete = () => {
          setIsGeneratingTTS(false);
          if (previewChunks.length > 0) {
            // Play back the PCM chunks
            const totalLen = previewChunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const combined = new Int16Array(totalLen);
            let offset = 0;
            for (const chunk of previewChunks) {
              combined.set(chunk, offset);
              offset += chunk.length;
            }
            
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const buffer = audioCtx.createBuffer(1, combined.length, 24000);
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < combined.length; i++) {
              channelData[i] = combined[i] / 32768.0;
            }
            
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.start(0);
          }
          client.disconnect();
        };

        client.onError = (err) => {
          console.error('Gemini TTS preview error:', err);
          toast.error('Failed to preview Gemini voice.');
          setIsGeneratingTTS(false);
          client.disconnect();
        };

        await client.connect({
          model: 'models/gemini-3.1-flash-live-preview',
          voiceName: ttsVoice,
          systemInstruction: 'Read the text provided by the user naturally.'
        });
        
        client.sendText(ttsText);
        
      } catch (err) {
        console.error('Gemini TTS preview setup error:', err);
        setIsGeneratingTTS(false);
      }
      return;
    }

    // Cancel any running speech synthesis or custom audio element preview to prevent overlapping voices
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.src = '';
      } catch (_) {}
      ttsAudioRef.current = null;
    }
    window.speechSynthesis.cancel();
    
    if (ttsEngine === 'edge') {
      try {
        setIsGeneratingTTS(true);
        const audioUrl = `/api/tts?text=${encodeURIComponent(ttsText)}&voice=${ttsVoice}&rate=${ttsRate}&pitch=${ttsPitch}`;
        const audio = new Audio(audioUrl);
        ttsAudioRef.current = audio;
        
        audio.oncanplaythrough = () => {
          audio.play().catch(() => {});
          setIsGeneratingTTS(false);
        };
        audio.onended = () => {
          if (ttsAudioRef.current === audio) {
            ttsAudioRef.current = null;
          }
        };
        audio.onerror = (e) => {
          console.error('Edge TTS preview error:', e);
          toast.error('Failed to preview Edge natural voice. Falling back to standard system voice.');
          setIsGeneratingTTS(false);
          if (ttsAudioRef.current === audio) {
            ttsAudioRef.current = null;
          }
          // Fallback to standard
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(ttsText);
          utterance.lang = ttsLanguage;
          utterance.rate = ttsRate;
          utterance.pitch = ttsPitch;
          window.speechSynthesis.speak(utterance);
        };
      } catch (err) {
        console.error('Edge TTS preview setup error:', err);
        setIsGeneratingTTS(false);
      }
    } else if (ttsEngine === 'neural') {
      const puter = (window as any).puter;
      if (puter) {
        try {
          setIsGeneratingTTS(true);
          const audio = await puter.ai.txt2speech(ttsText, {
            provider: 'openai',
            model: 'tts-1',
            voice: ttsVoice
          });
          
          const audioEl = new Audio(audio.src);
          ttsAudioRef.current = audioEl;
          audioEl.oncanplaythrough = () => {
            audioEl.play().catch(() => {});
            setIsGeneratingTTS(false);
          };
          audioEl.onended = () => {
            if (ttsAudioRef.current === audioEl) {
              ttsAudioRef.current = null;
            }
          };
          audioEl.onerror = () => {
            setIsGeneratingTTS(false);
            if (ttsAudioRef.current === audioEl) {
              ttsAudioRef.current = null;
            }
          };
        } catch (err) {
          console.error('Puter TTS preview error:', err);
          toast.error('Failed to preview neural voice. Falling back to standard system voice.');
          setIsGeneratingTTS(false);
          // Fallback to standard
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(ttsText);
          utterance.lang = ttsLanguage;
          utterance.rate = ttsRate;
          utterance.pitch = ttsPitch;
          window.speechSynthesis.speak(utterance);
        }
      } else {
        // Fallback if Puter script is blocked/failed
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(ttsText);
        utterance.lang = ttsLanguage;
        utterance.rate = ttsRate;
        utterance.pitch = ttsPitch;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(ttsText);
      utterance.lang = ttsLanguage;
      utterance.rate = ttsRate;
      utterance.pitch = ttsPitch;
      window.speechSynthesis.speak(utterance);
    }
  };

const generateTTS = async () => {
    if (!ttsText.trim()) return;
    setIsGeneratingTTS(true);
    try {
      let blob: Blob;
      let mimeType = 'audio/mp3';
      
      if (ttsEngine === 'gemini') {
        const { GeminiLiveClient } = await import('@/utils/geminiLiveClient');
        const client = new GeminiLiveClient();
        
        let pcmChunks: Int16Array[] = [];
        
        client.onAudioData = (pcmData) => {
          pcmChunks.push(pcmData);
        };
        
        await new Promise<void>((resolve, reject) => {
          client.onTurnComplete = () => { resolve(); };
          client.onError = (err) => { reject(err); };
          
          client.connect({
            model: 'models/gemini-3.1-flash-live-preview',
            voiceName: ttsVoice,
            systemInstruction: 'Read the text provided by the user naturally. Generate only audio, no text.'
          }).then(() => {
            client.sendText(ttsText);
          }).catch(reject);
        });
        
        client.disconnect();
        
        if (pcmChunks.length === 0) throw new Error('No audio data received from Gemini.');
        
        // Combine PCM chunks
        const totalLen = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Int16Array(totalLen);
        let offset = 0;
        for (const chunk of pcmChunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Create simple WAV blob from PCM (16-bit, 24000Hz, Mono)
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        const writeString = (view: DataView, offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + combined.byteLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, 24000, true); // Sample rate
        view.setUint32(28, 24000 * 2, true); // Byte rate
        view.setUint16(32, 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample
        writeString(view, 36, 'data');
        view.setUint32(40, combined.byteLength, true);
        
        blob = new Blob([wavHeader, combined], { type: 'audio/wav' });
        mimeType = 'audio/wav';
        
      } else if (ttsEngine === 'edge') {
        const ttsUrl = `/api/tts?text=${encodeURIComponent(ttsText)}&voice=${ttsVoice}&rate=${ttsRate}&pitch=${ttsPitch}`;
        const response = await fetch(ttsUrl);
        if (!response.ok) throw new Error('Failed to generate audio from Edge TTS proxy.');
        blob = await response.blob();
        mimeType = blob.type || 'audio/mp3';
      } else if (ttsEngine === 'neural') {
        const puter = (window as any).puter;
        if (!puter) {
          throw new Error('Puter AI engine is not loaded. Make sure you have active internet connection.');
        }
        
        const audio = await puter.ai.txt2speech(ttsText, {
          provider: 'openai',
          model: 'tts-1',
          voice: ttsVoice
        });
        
        const response = await fetch(audio.src);
        if (!response.ok) throw new Error('Failed to fetch audio from neural source.');
        blob = await response.blob();
        mimeType = blob.type || 'audio/mp3';
      } else {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLanguage}&client=tw-ob&q=${encodeURIComponent(ttsText)}`;
        const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(ttsUrl)}`;
        
        const response = await fetch(proxiedUrl);
        if (!response.ok) throw new Error('Failed to generate audio from standard TTS proxy.');
        blob = await response.blob();
      }
      
      const audioUrl = URL.createObjectURL(blob);
      const mediaId = `tts_${Date.now()}`;
      const engineName = ttsEngine === 'edge' ? 'Edge' : (ttsEngine === 'neural' ? 'Neural' : (ttsEngine === 'gemini' ? 'Gemini' : 'TTS'));
      const mediaItem = {
        id: mediaId,
        name: `${engineName}: ${ttsText.slice(0, 25)}...`,
        type: 'audio' as const,
        duration: 5,
        url: audioUrl,
        createdAt: Date.now(),
      };

      const audioEl = document.createElement('audio');
      audioEl.src = audioUrl;

      // FIX M1+M2: Guard against loadedmetadata never firing with a timeout,
      // and revoke the intermediate object URL once the file is saved to DB.
      let settled = false;
      const settle = async () => {
        if (settled) return;
        settled = true;
        clearTimeout(metaTimeout);

        const realDuration = (!isNaN(audioEl.duration) && audioEl.duration > 0) ? audioEl.duration : 5;
        const peaks: number[] = Array.from({ length: 100 }, () => 0.1 + Math.random() * 0.7);

        const finalMediaItem = {
          ...mediaItem,
          duration: realDuration,
          waveformPeaks: peaks,
        };

        try {
          await useEditorStore.getState().addMedia(finalMediaItem, new File([blob], `tts_${mediaId}.mp3`, { type: mimeType }));
        } catch (err) {
          console.error('Failed to save TTS to DB:', err);
          useEditorStore.getState().addMedia(finalMediaItem);
        }

        audioEl.src = '';
        audioEl.remove();
        // Revoke the blob URL to free the pinned binary data from memory
        URL.revokeObjectURL(audioUrl);

        setIsGeneratingTTS(false);
        setTtsText('');
        setActiveMediaTab('project');
      };

      const metaTimeout = window.setTimeout(settle, 5000);
      audioEl.addEventListener('loadedmetadata', settle, { once: true });
      audioEl.addEventListener('error', settle, { once: true });
    } catch (err: any) {
      console.error('TTS Generation error:', err);
      toast.error(`Failed to generate TTS audio: ${err.message || 'Unknown error'}`);
      setIsGeneratingTTS(false);
    }
  };


  
  return {
    ttsText, setTtsText,
    ttsLanguage, setTtsLanguage,
    ttsRate, setTtsRate,
    ttsPitch, setTtsPitch,
    ttsEngine, setTtsEngine,
    ttsVoice, setTtsVoice,
    isGeneratingTTS,
    ttsAudioRef,
    previewTTS,
    generateTTS
  };
}
