import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Play, Pause, FastForward, Rewind, Maximize2, Minimize2, Type,
  Mic, MicOff, Volume2, VolumeX, RotateCcw, CheckCircle2, Sparkles,
  Sliders, Eye, Camera, ChevronRight, ChevronLeft, Download, Film,
  Wand2, Radio, Check, AlertCircle, Headphones, Video, VideoOff,
  Split, ArrowRight, Layers, SlidersHorizontal, RefreshCw, HardDrive,
  Cpu, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/store/editorStore';
import {
  parseScriptToDialogueSentences,
  DialogueSentence,
  TeleprompterSpeechTracker,
  TrackingMode,
} from '@/utils/teleprompterSpeechTracker';
import {
  StudioMicProcessor,
  STUDIO_MIC_PRESETS,
  StudioMicPresetId,
  StudioMicSettings,
} from '@/utils/studioMicProcessor';
import {
  StudioVideoEnhancer,
  STUDIO_VIDEO_PRESETS,
  StudioVideoPresetId,
  StudioVideoSettings,
} from '@/utils/studioVideoEnhancer';
import {
  upscaleVideoClarity,
  UPSCALE_RESOLUTIONS,
  UpscaleTargetResolution,
  UpscaleProgress,
} from '@/utils/videoUpscaler';
import {
  analyzeRecordingWithWhisper,
  getAiDialogueCoaching,
  trimAndTightenAudioSilences,
  DialogueSmoothingReport,
} from '@/utils/dialogueSmoothing';
import {
  saveRecordingToSsd,
  loadRecordingFromSsd,
} from '@/utils/ssdRecordingStorage';
import { extractWaveformFromUrl } from '@/utils/mediaProbe';

interface TeleprompterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'setup' | 'prompter' | 'studio';
type RecordMode = 'video-audio' | 'audio-only';

const DEFAULT_SCRIPT = `Welcome back everyone! In today's video, we are taking video editing to a whole new level.
Notice how smooth and crystal clear this dialogue is delivered.
Every single sentence flows naturally, and the microphone sounds like a high-end broadcast studio.
Thank you for watching, and let us dive right into the project!`;

const SCRIPT_TEMPLATES = [
  {
    title: 'YouTube Viral Hook',
    text: `Stop scrolling! If you are making videos with your laptop mic and blurry webcam, you are losing half your audience.
In the next sixty seconds, I will show you how to get studio quality video and broadcast audio instantly.
The difference will blow your mind, so watch closely!`,
  },
  {
    title: 'Cinematic Documentary',
    text: `Deep beneath the surface of the quiet ocean, a world of mystery unfolds.
Centuries have passed, yet the ancient rhythms of nature continue undisturbed.
Every breath, every whisper tells a story waiting to be discovered.`,
  },
  {
    title: 'Tech Product Launch',
    text: `Today, we are introducing something truly revolutionary.
Engineered from the ground up to give creators total freedom and effortless control.
This is not just an update. This is the future of digital storytelling.`,
  },
];

export const SPEECH_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
  { code: 'ur-PK', label: 'Urdu (اردو)' },
  { code: 'es-ES', label: 'Spanish (Español)' },
  { code: 'fr-FR', label: 'French (Français)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
];

export const TRACKING_MODES_DEF: { id: TrackingMode; label: string; desc: string; icon: string }[] = [
  {
    id: 'voice-follow',
    label: 'Voice Follow',
    desc: 'Strictly advances words as you speak them. Zero auto-rushing.',
    icon: '🎙️',
  },
  {
    id: 'smart-hybrid',
    label: 'Smart Hybrid',
    desc: 'Voice tracking with smooth fallback pacing during prolonged pauses.',
    icon: '✨',
  },
  {
    id: 'auto-pacer',
    label: 'Auto-Pacer',
    desc: 'Steady continuous speed determined by the WPM reading slider.',
    icon: '⚡',
  },
];

export function TeleprompterModal({ isOpen, onClose }: TeleprompterModalProps) {
  // Navigation & View state
  const [activeView, setActiveView] = useState<ModalView>('setup');
  const [recordMode, setRecordMode] = useState<RecordMode>('video-audio');
  const [scriptText, setScriptText] = useState(DEFAULT_SCRIPT);
  const [sentences, setSentences] = useState<DialogueSentence[]>([]);
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(0);
  const [currentWordIdx, setCurrentWordIdx] = useState(0);

  // Available Hardware Devices
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');

  // Prompter display settings
  const [fontSize, setFontSize] = useState(52);
  const [wpm, setWpm] = useState(130);
  const [mirror, setMirror] = useState(false);
  const [showEyeLine, setShowEyeLine] = useState(true);
  const [webcamOpacity, setWebcamOpacity] = useState(40);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Playback & Tracking state
  const [isRunning, setIsRunning] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownVal, setCountdownVal] = useState(3);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Speech Recognition & Tracking Mode state
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('voice-follow');
  const [speechLanguage, setSpeechLanguage] = useState<string>('en-US');
  const [noiseReductionMode, setNoiseReductionMode] = useState<'studio-dsp' | 'ai-webrtc' | 'both' | 'off'>('studio-dsp');

  // Studio Mic DSP state
  const [micPresetId, setMicPresetId] = useState<StudioMicPresetId>('natural-studio');
  const [studioMicEnabled, setStudioMicEnabled] = useState(true);
  const [micMonitoring, setMicMonitoring] = useState(false);
  const [showDspControls, setShowDspControls] = useState(false);
  const [dspSettings, setDspSettings] = useState<StudioMicSettings>({ ...STUDIO_MIC_PRESETS['natural-studio'].settings });
  const [vuTelemetry, setVuTelemetry] = useState({ db: -100, peakDb: -100, gateOpen: true, rms: 0 });

  // Studio Camera Enhancer state (Auto Beautifier, Denoise, Lighting)
  const [cameraPresetId, setCameraPresetId] = useState<StudioVideoPresetId>('studio-broadcast');
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [cameraSettings, setCameraSettings] = useState<StudioVideoSettings>({ ...STUDIO_VIDEO_PRESETS['studio-broadcast'].settings });

  // Recording & Media state
  const [rawAudioStream, setRawAudioStream] = useState<MediaStream | null>(null);
  const [rawVideoStream, setRawVideoStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMediaUrl, setRecordedMediaUrl] = useState<string | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [ssdStorageKey, setSsdStorageKey] = useState<string | null>(null);
  const [isSavedToSsd, setIsSavedToSsd] = useState(false);
  const [isSavingToSsd, setIsSavingToSsd] = useState(false);
  const [savedDiskFilename, setSavedDiskFilename] = useState<string | null>(null);

  // 4K Super-Resolution & Clarity Upscaler state
  const [upscaleTarget, setUpscaleTarget] = useState<UpscaleTargetResolution>('4k');
  const [upscaleSharpness, setUpscaleSharpness] = useState(70);
  const [upscaleContrast, setUpscaleContrast] = useState(40);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState<UpscaleProgress | null>(null);
  const [upscaledVideoBlob, setUpscaledVideoBlob] = useState<Blob | null>(null);
  const [upscaledVideoUrl, setUpscaledVideoUrl] = useState<string | null>(null);
  const [comparisonSliderPos, setComparisonSliderPos] = useState(50); // 0 to 100%

  // Post-Recording Polish state
  const [isAnalyzingWhisper, setIsAnalyzingWhisper] = useState(false);
  const [isCoachingGemini, setIsCoachingGemini] = useState(false);
  const [isTighteningAudio, setIsTighteningAudio] = useState(false);
  const [whisperReport, setWhisperReport] = useState<DialogueSmoothingReport | null>(null);
  const [geminiCoaching, setGeminiCoaching] = useState<string | null>(null);
  const [tightenedSavedSec, setTightenedSavedSec] = useState<number | null>(null);

  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const liveVideoPreviewRef = useRef<HTMLVideoElement>(null);
  const enhancedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const studioProcessorRef = useRef<StudioMicProcessor | null>(null);
  const studioVideoEnhancerRef = useRef<StudioVideoEnhancer | null>(null);
  const speechTrackerRef = useRef<TeleprompterSpeechTracker | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vuMeterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 1. Query Hardware Media Devices ──────────────────────────────────────
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter((d) => d.kind === 'videoinput');
      const audioDevs = devices.filter((d) => d.kind === 'audioinput');

      setAvailableCameras(videoDevs);
      setAvailableMics(audioDevs);

      if (!selectedCameraId && videoDevs.length > 0) {
        setSelectedCameraId(videoDevs[0].deviceId);
      }
      if (!selectedMicId && audioDevs.length > 0) {
        setSelectedMicId(audioDevs[0].deviceId);
      }
    } catch (e) {
      console.warn('Error enumerating media devices:', e);
    }
  }, [selectedCameraId, selectedMicId]);

  useEffect(() => {
    if (isOpen) {
      refreshDevices();
    }
  }, [isOpen, refreshDevices]);

  // ── 2. Parse Script into Sentences ───────────────────────────────────────
  useEffect(() => {
    const parsed = parseScriptToDialogueSentences(scriptText, wpm);
    setSentences(parsed);
    setCurrentSentenceIdx(0);
    setCurrentWordIdx(0);
  }, [scriptText, wpm]);

  // ── 3. Initialize Microphone & Studio DSP Rack ───────────────────────────
  const initMicrophone = useCallback(async (deviceId?: string) => {
    try {
      if (rawAudioStream) {
        rawAudioStream.getTracks().forEach((t) => t.stop());
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Microphone access is unavailable (requires HTTPS or localhost).');
        return null;
      }

      const useWebRtc = noiseReductionMode === 'ai-webrtc' || noiseReductionMode === 'both';
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: useWebRtc, // When using Studio DSP, false prevents browser WebRTC from muffling vocals
        autoGainControl: false,      // Handled by our studio compressor & limiter
      };
      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      setRawAudioStream(stream);

      // Create Studio Mic DSP Processor
      const processor = new StudioMicProcessor();
      studioProcessorRef.current = processor;
      await processor.init(stream, micPresetId);

      // Start live VU meter update
      if (vuMeterIntervalRef.current) clearInterval(vuMeterIntervalRef.current);
      vuMeterIntervalRef.current = setInterval(() => {
        if (studioProcessorRef.current) {
          const telem = studioProcessorRef.current.getMeterTelemetry();
          setVuTelemetry(telem);
        }
      }, 50);

      refreshDevices();
      return stream;
    } catch (err: any) {
      console.warn('Microphone initialization failed:', err);
      toast.error(`Microphone error: ${err.message || 'Check microphone permissions'}`);
      return null;
    }
  }, [micPresetId, refreshDevices, rawAudioStream, noiseReductionMode]);

  // ── 4. Initialize Camera & Studio Video Enhancer ─────────────────────────
  const initCamera = useCallback(async (deviceId?: string) => {
    try {
      if (rawVideoStream) {
        rawVideoStream.getTracks().forEach((t) => t.stop());
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Camera access is unavailable.');
        return null;
      }

      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 },
        frameRate: { ideal: 30, min: 24 },
      };
      if (deviceId) {
        videoConstraints.deviceId = { exact: deviceId };
      } else {
        videoConstraints.facingMode = 'user';
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      setRawVideoStream(stream);

      if (liveVideoPreviewRef.current) {
        liveVideoPreviewRef.current.srcObject = stream;
        liveVideoPreviewRef.current.play().catch(() => {});
      }

      // Initialize Studio Video Enhancer
      if (!studioVideoEnhancerRef.current) {
        studioVideoEnhancerRef.current = new StudioVideoEnhancer();
      }
      studioVideoEnhancerRef.current.setPreset(cameraPresetId);

      if (liveVideoPreviewRef.current) {
        studioVideoEnhancerRef.current.start(liveVideoPreviewRef.current);
      }

      refreshDevices();
      return stream;
    } catch (err: any) {
      console.warn('Camera initialization failed:', err);
      toast.error(`Camera error: ${err.message || 'Could not access camera'}`);
      return null;
    }
  }, [cameraPresetId, refreshDevices, rawVideoStream]);

  // Switch Camera Device
  const handleCameraDeviceChange = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    await initCamera(deviceId);
    toast.success('Switched Camera Source');
  };

  // Switch Mic Device
  const handleMicDeviceChange = async (deviceId: string) => {
    setSelectedMicId(deviceId);
    await initMicrophone(deviceId);
    toast.success('Switched Microphone Source');
  };

  // Change Word-Tracking Mode
  const handleTrackingModeChange = (mode: TrackingMode) => {
    setTrackingMode(mode);
    if (speechTrackerRef.current) {
      speechTrackerRef.current.setOptions({ trackingMode: mode });
    }
    toast.info(`Tracking: ${
      mode === 'voice-follow' ? '🎙️ Strict Voice Follow (Follows your voice)' :
      mode === 'smart-hybrid' ? '✨ Smart Hybrid (Voice + Pacer)' :
      '⚡ Auto-Pacer (Fixed Cadence)'
    }`);
  };

  // Change Speech Recognition Language
  const handleLanguageChange = (lang: string) => {
    setSpeechLanguage(lang);
    if (speechTrackerRef.current) {
      speechTrackerRef.current.setOptions({ language: lang });
    }
    const found = SPEECH_LANGUAGES.find((l) => l.code === lang);
    toast.info(`Speech Language: ${found?.label || lang}`);
  };

  // Change Noise Reduction Mode
  const handleNoiseReductionModeChange = async (mode: 'studio-dsp' | 'ai-webrtc' | 'both' | 'off') => {
    setNoiseReductionMode(mode);
    const useWebRtc = mode === 'ai-webrtc' || mode === 'both';
    if (rawAudioStream) {
      const track = rawAudioStream.getAudioTracks()[0];
      if (track && track.applyConstraints) {
        try {
          await track.applyConstraints({
            noiseSuppression: useWebRtc,
            echoCancellation: true,
            autoGainControl: false,
          });
        } catch {
          await initMicrophone(selectedMicId);
        }
      }
    }
    if (studioProcessorRef.current) {
      const enableDsp = mode === 'studio-dsp' || mode === 'both';
      studioProcessorRef.current.updateSettings({ enabled: enableDsp });
      setStudioMicEnabled(enableDsp);
    }
    toast.success(`Noise Filter: ${
      mode === 'studio-dsp' ? 'Studio Mic DSP (Zero Muffle, Natural)' :
      mode === 'ai-webrtc' ? 'Browser WebRTC Suppression' :
      mode === 'both' ? 'Hybrid DSP + WebRTC' : 'Bypass / Direct Raw'
    }`);
  };

  // Update Studio Mic Preset
  const handlePresetChange = (presetId: StudioMicPresetId) => {
    setMicPresetId(presetId);
    if (studioProcessorRef.current) {
      studioProcessorRef.current.setPreset(presetId);
      setDspSettings(studioProcessorRef.current.settings);
      setStudioMicEnabled(studioProcessorRef.current.settings.enabled);
    }
  };

  // Update Studio Video Preset
  const handleCameraPresetChange = (presetId: StudioVideoPresetId) => {
    setCameraPresetId(presetId);
    if (studioVideoEnhancerRef.current) {
      studioVideoEnhancerRef.current.setPreset(presetId);
      setCameraSettings(studioVideoEnhancerRef.current.settings);
    }
  };

  // Toggle DSP Enabled / Bypass
  const handleToggleDsp = (enabled: boolean) => {
    setStudioMicEnabled(enabled);
    if (studioProcessorRef.current) {
      studioProcessorRef.current.updateSettings({ enabled });
      setDspSettings((s) => ({ ...s, enabled }));
    }
  };

  // Toggle Monitoring
  const handleToggleMonitoring = (mon: boolean) => {
    setMicMonitoring(mon);
    if (studioProcessorRef.current) {
      studioProcessorRef.current.updateSettings({ monitoring: mon });
      setDspSettings((s) => ({ ...s, monitoring: mon }));
    }
  };

  // Update fine-tune Audio DSP settings
  const handleUpdateDspSetting = (field: keyof StudioMicSettings, val: number) => {
    setDspSettings((prev) => {
      const next = { ...prev, [field]: val };
      if (studioProcessorRef.current) {
        studioProcessorRef.current.updateSettings({ [field]: val });
      }
      return next;
    });
  };

  // Update fine-tune Camera settings
  const handleUpdateCameraSetting = (field: keyof StudioVideoSettings, val: number) => {
    setCameraSettings((prev) => {
      const next = { ...prev, [field]: val };
      if (studioVideoEnhancerRef.current) {
        studioVideoEnhancerRef.current.updateSettings({ [field]: val });
      }
      return next;
    });
  };

  // ── 5. Teleprompter Speech Tracker Setup ──────────────────────────────────
  useEffect(() => {
    if (sentences.length === 0) return;

    const tracker = new TeleprompterSpeechTracker(sentences, {
      wpm,
      autoAdvance,
      fuzzyTolerance: 1,
      language: speechLanguage,
      trackingMode,
    });
    speechTrackerRef.current = tracker;

    tracker.onEvent((event) => {
      if (event.type === 'word-advance') {
        setCurrentSentenceIdx(event.sentenceIndex);
        setCurrentWordIdx(event.wordIndex);
      } else if (event.type === 'sentence-complete') {
        setCurrentSentenceIdx(event.sentenceIndex);
        toast.success(`Sentence ${event.sentenceIndex + 1} delivered!`, { duration: 1500 });
      } else if (event.type === 'session-end') {
        handleFinishSession();
      }
    });

    return () => {
      tracker.dispose();
      speechTrackerRef.current = null;
    };
  }, [sentences, wpm, autoAdvance, speechLanguage, trackingMode]);

  // ── 6. Start Teleprompter & Recording Session ────────────────────────────
  const handleStartSession = async () => {
    if (!sentences.length) {
      toast.error('Please enter a script before starting.');
      return;
    }

    // Ensure mic is ready
    let micStream = rawAudioStream;
    if (!micStream) {
      micStream = await initMicrophone(selectedMicId);
    }
    if (!micStream) return;

    // Ensure camera is ready if recording video
    if (recordMode === 'video-audio') {
      let camStream = rawVideoStream;
      if (!camStream) {
        camStream = await initCamera(selectedCameraId);
      }
      if (!camStream) {
        toast.info('Continuing in Audio-Only mode.');
        setRecordMode('audio-only');
      }
    }

    setActiveView('prompter');
    setIsCountingDown(true);
    setCountdownVal(3);

    let count = 3;
    const cdInterval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdownVal(count);
      } else {
        clearInterval(cdInterval);
        setIsCountingDown(false);
        beginRecordingAndTracking();
      }
    }, 1000);
  };

  const beginRecordingAndTracking = () => {
    setIsRunning(true);
    setIsRecording(true);
    setElapsedSeconds(0);

    // Elapsed timer
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    // Prepare recording stream
    try {
      recordedChunksRef.current = [];
      let recordStream: MediaStream | null = null;
      let mimeType = 'video/webm';
      let recorderOptions: MediaRecorderOptions = {};

      const audioTrack = (studioProcessorRef.current as any)?.destinationNode?.stream?.getAudioTracks()[0]
        || rawAudioStream?.getAudioTracks()[0];

      if (recordMode === 'video-audio') {
        // Ensure studio video enhancer is running on the live preview video
        if (studioVideoEnhancerRef.current && liveVideoPreviewRef.current) {
          studioVideoEnhancerRef.current.start(liveVideoPreviewRef.current);
        }

        // Use enhanced studio canvas stream merged with studio mic audio
        const enhancedStream = studioVideoEnhancerRef.current?.getOutputStream(30) || rawVideoStream;
        if (enhancedStream) {
          recordStream = new MediaStream();
          const videoTrack = enhancedStream.getVideoTracks()[0];
          if (videoTrack) recordStream.addTrack(videoTrack);
          if (audioTrack) recordStream.addTrack(audioTrack);
        }

        // Prioritize hardware-accelerated VP8 and H.264 codecs over software-heavy VP9 to eliminate recording lag
        const candidateVideoCodecs = [
          'video/webm;codecs=vp8,opus',
          'video/mp4;codecs=avc1,mp4a',
          'video/mp4;codecs=h264,aac',
          'video/webm;codecs=vp9,opus',
          'video/webm',
          'video/mp4',
        ];
        const supported = candidateVideoCodecs.find((t) => {
          try {
            return MediaRecorder.isTypeSupported(t);
          } catch {
            return false;
          }
        });
        mimeType = supported || 'video/webm';
        recorderOptions = {
          mimeType,
          videoBitsPerSecond: 4_500_000, // 4.5 Mbps ensures crystal-clear 1080p without encoder backpressure
          audioBitsPerSecond: 128_000,
        };
      } else {
        // Audio-only recording
        recordStream = (studioProcessorRef.current as any)?.destinationNode?.stream || rawAudioStream;
        const candidateAudioCodecs = [
          'audio/webm;codecs=opus',
          'audio/ogg;codecs=opus',
          'audio/webm',
          'audio/mp4',
        ];
        const supported = candidateAudioCodecs.find((t) => {
          try {
            return MediaRecorder.isTypeSupported(t);
          } catch {
            return false;
          }
        });
        mimeType = supported || 'audio/webm';
        recorderOptions = {
          mimeType,
          audioBitsPerSecond: 192_000,
        };
      }

      if (recordStream) {
        const recorder = new MediaRecorder(recordStream, recorderOptions);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          setRecordedBlob(blob);
          const url = URL.createObjectURL(blob);
          setRecordedMediaUrl(url);

          if (recordMode === 'video-audio') {
            setRecordedVideoBlob(blob);
          } else {
            setRecordedAudioBlob(blob);
          }

          // Safety First: Offload directly to SSD physical storage (IndexedDB + Disk Download)
          try {
            setIsSavingToSsd(true);
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `teleprompter-take-${timestamp}.${ext}`;
            const recId = `ssd_take_${Date.now()}`;
            setSsdStorageKey(recId);
            setSavedDiskFilename(filename);

            await saveRecordingToSsd(recId, blob, filename, true);
            setIsSavedToSsd(true);
            toast.success(`💾 Recording safely saved to SSD & downloaded to disk (${filename})!`);
          } catch (err) {
            console.warn('[TeleprompterModal] Error writing recording to SSD:', err);
          } finally {
            setIsSavingToSsd(false);
          }
        };

        // 1000ms timeslice eliminates main-thread GC stutter during high-framerate capture
        recorder.start(1000);
      }
    } catch (e) {
      console.warn('Error starting MediaRecorder:', e);
    }

    // Start real-time speech tracker
    if (speechTrackerRef.current) {
      speechTrackerRef.current.start();
    }
  };

  const handlePauseToggle = () => {
    if (isRunning) {
      setIsRunning(false);
      speechTrackerRef.current?.pause();
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    } else {
      setIsRunning(true);
      speechTrackerRef.current?.resume();
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
  };

  const handleRetakeSentence = () => {
    speechTrackerRef.current?.retakeCurrentSentence();
    setCurrentWordIdx(0);
    toast.info(`Retaking Sentence ${currentSentenceIdx + 1}`);
  };

  const handleNextSentence = () => {
    speechTrackerRef.current?.nextSentence();
  };

  const handlePrevSentence = () => {
    speechTrackerRef.current?.prevSentence();
  };

  const handleFinishSession = () => {
    setIsRunning(false);
    setIsRecording(false);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    speechTrackerRef.current?.stop();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    setActiveView('studio');
    toast.success('Recording completed! Original saved safely. Welcome to Polish & 4K Upscale Studio.');
  };

  // ── 7. 4K Super-Resolution & Clarity Upscaler ────────────────────────────
  const handleRunUpscaler = async () => {
    let sourceBlob = recordedVideoBlob || recordedBlob;
    if (!sourceBlob && ssdStorageKey) {
      try {
        sourceBlob = await loadRecordingFromSsd(ssdStorageKey);
      } catch (err) {
        console.warn('Could not load from SSD storage:', err);
      }
    }
    if (!sourceBlob) {
      toast.error('No video recording available to upscale.');
      return;
    }

    setIsUpscaling(true);
    setUpscaleProgress({
      percent: 0,
      currentSecond: 0,
      totalSeconds: 0,
      fps: 30,
      gpuVramMb: UPSCALE_RESOLUTIONS[upscaleTarget].estimatedGpuVramMb,
    });

    try {
      const upscaled = await upscaleVideoClarity(
        sourceBlob,
        {
          targetResolution: upscaleTarget,
          sharpness: upscaleSharpness,
          contrastEnhance: upscaleContrast,
          denoisePrePass: true,
          lowGpuMemoryBudget: true, // Caps GPU memory strictly under 400 MB
        },
        (progress) => {
          setUpscaleProgress(progress);
        }
      );

      setUpscaledVideoBlob(upscaled);
      const url = URL.createObjectURL(upscaled);
      setUpscaledVideoUrl(url);
      toast.success(`Video successfully upscaled to ${UPSCALE_RESOLUTIONS[upscaleTarget].label}!`);
    } catch (err: any) {
      console.error('Upscaling error:', err);
      toast.error(`Upscaling failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUpscaling(false);
    }
  };

  // ── 8. Post-Recording Polish (Whisper & Gemini) ───────────────────────────
  const handleRunWhisperAnalysis = async () => {
    const targetBlob = recordedBlob;
    if (!targetBlob) {
      toast.error('No recorded audio available.');
      return;
    }

    setIsAnalyzingWhisper(true);
    try {
      const report = await analyzeRecordingWithWhisper(targetBlob, scriptText);
      setWhisperReport(report);
      toast.success(`Whisper Alignment Complete: Fluency Score ${report.fluencyScore}%!`);
    } catch (err: any) {
      toast.error(err.message || 'Whisper analysis failed. Verify Groq API key.');
    } finally {
      setIsAnalyzingWhisper(false);
    }
  };

  const handleRunGeminiCoaching = async () => {
    const transcript = whisperReport?.fullTranscript || scriptText;
    setIsCoachingGemini(true);
    try {
      const coaching = await getAiDialogueCoaching(transcript, scriptText);
      setGeminiCoaching(coaching.coachingAdvice);
      toast.success('AI Dialogue Coaching ready!');
    } catch (err: any) {
      toast.error(err.message || 'AI coaching failed.');
    } finally {
      setIsCoachingGemini(false);
    }
  };

  const handleTightenSilences = async () => {
    const targetBlob = recordedBlob;
    if (!targetBlob) return;

    setIsTighteningAudio(true);
    try {
      const { tightenedBlob: tBlob, savedDurationSec } = await trimAndTightenAudioSilences(targetBlob);
      setTightenedSavedSec(savedDurationSec);
      const newUrl = URL.createObjectURL(tBlob);
      setRecordedMediaUrl(newUrl);
      toast.success(`Dead-air tightened! Saved ${savedDurationSec}s of awkward pauses.`);
    } catch (err: any) {
      toast.error(`Silence trimming error: ${err.message}`);
    } finally {
      setIsTighteningAudio(false);
    }
  };

  // ── 9. Insert to Timeline ────────────────────────────────────────────────
  const handleAddToTimeline = async () => {
    const finalVideoBlob = upscaledVideoBlob || recordedVideoBlob;
    const finalBlob = finalVideoBlob || recordedBlob;
    const finalUrl = upscaledVideoUrl || recordedMediaUrl;
    if (!finalBlob || !finalUrl) {
      toast.error('No media recording found.');
      return;
    }

    try {
      const { tracks, addTrack, addMedia, addClip, currentTime } = useEditorStore.getState();

      const isVideo = recordMode === 'video-audio' && !!finalVideoBlob;

      // Find or create target track
      let targetTrack = tracks.find((t) => t.type === (isVideo ? 'video' : 'audio'));
      if (!targetTrack) {
        addTrack(isVideo ? 'video' : 'audio');
        targetTrack = useEditorStore.getState().tracks.find((t) => t.type === (isVideo ? 'video' : 'audio'));
      }

      if (!targetTrack) {
        toast.error('Could not create track.');
        return;
      }

      // Probing media duration
      const mediaDuration = await new Promise<number>((resolve) => {
        const media = isVideo ? document.createElement('video') : new Audio();
        media.src = finalUrl;
        media.onloadedmetadata = () => {
          resolve(isFinite(media.duration) && media.duration > 0 ? media.duration : Math.max(1, elapsedSeconds));
        };
        media.onerror = () => resolve(Math.max(1, elapsedSeconds));
      });

      let peaks: number[] = [];
      try {
        peaks = await extractWaveformFromUrl(finalUrl);
      } catch {
        peaks = Array.from({ length: 150 }, () => 0.5);
      }

      const mediaId = `prompter_studio_${Date.now()}`;
      const name = isVideo
        ? `Studio Prompter Video ${upscaledVideoBlob ? '(4K Remastered)' : '(Enhanced)'}`
        : `Studio Prompter Dialogue (${micPresetId})`;

      const mediaItem = {
        id: mediaId,
        name,
        type: (isVideo ? 'video' : 'audio') as 'video' | 'audio',
        duration: Number(mediaDuration.toFixed(2)),
        url: finalUrl,
        createdAt: Date.now(),
        waveformPeaks: peaks,
      };

      const fileExtension = isVideo ? 'webm' : 'wav';
      await addMedia(mediaItem, new File([finalBlob], `${mediaId}.${fileExtension}`, { type: finalBlob.type }));

      const clipId = `clip_prompter_${Math.random().toString(36).substring(2, 9)}`;
      addClip({
        id: clipId,
        mediaId,
        trackId: targetTrack.id,
        startTime: currentTime || 0,
        duration: Number(mediaDuration.toFixed(2)),
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: 1,
        effects: [],
      });

      toast.success(`${isVideo ? '4K Studio Video' : 'Studio Dialogue'} added to Timeline!`, { duration: 3000 });
      onClose();
    } catch (err: any) {
      console.error('Error adding prompter media to timeline:', err);
      toast.error(`Failed to add clip: ${err.message}`);
    }
  };

  // ── 10. Download Media ───────────────────────────────────────────────────
  const handleDownloadMedia = () => {
    const finalBlob = upscaledVideoBlob || recordedVideoBlob || recordedBlob;
    if (!finalBlob) return;

    const isVideo = recordMode === 'video-audio';
    const ext = isVideo ? 'webm' : 'wav';
    const filename = `Studio_${isVideo ? (upscaledVideoBlob ? '4K_Remaster' : 'Video') : 'Audio'}_Take_${Date.now()}.${ext}`;

    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}!`);
  };

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || activeView !== 'prompter') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePauseToggle();
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        e.preventDefault();
        handleNextSentence();
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault();
        handlePrevSentence();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRetakeSentence();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeView, isRunning, currentSentenceIdx]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      studioProcessorRef.current?.dispose();
      studioVideoEnhancerRef.current?.dispose();
      speechTrackerRef.current?.dispose();
      if (rawAudioStream) {
        rawAudioStream.getTracks().forEach((t) => t.stop());
      }
      if (rawVideoStream) {
        rawVideoStream.getTracks().forEach((t) => t.stop());
      }
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (vuMeterIntervalRef.current) clearInterval(vuMeterIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const currentSentence = sentences[currentSentenceIdx];
  const prevSentence = currentSentenceIdx > 0 ? sentences[currentSentenceIdx - 1] : null;
  const nextSentence = currentSentenceIdx < sentences.length - 1 ? sentences[currentSentenceIdx + 1] : null;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] bg-[#0c0d0e] text-white flex flex-col font-sans select-none ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-4'
      }`}
    >
      {/* Hidden Live Video element for canvas processing */}
      <video
        ref={liveVideoPreviewRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* ── TOP HEADER BAR ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#16181a] border border-[#2b2f33] rounded-t-xl z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-lg">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-bold text-xs uppercase tracking-wider text-emerald-400">
              Teleprompter Studio Pro • 4K
            </span>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex items-center bg-[#202326] p-1 rounded-lg border border-[#2e3338] text-xs">
            <button
              onClick={() => setActiveView('setup')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeView === 'setup'
                  ? 'bg-emerald-500 text-black shadow-sm font-semibold'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              1. Setup & Devices
            </button>
            <button
              onClick={() => {
                if (sentences.length > 0) setActiveView('prompter');
                else toast.error('Please enter a script first.');
              }}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeView === 'prompter'
                  ? 'bg-emerald-500 text-black shadow-sm font-semibold'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              2. Prompter & Studio Cam
            </button>
            <button
              onClick={() => {
                if (recordedBlob) setActiveView('studio');
                else toast.error('Record first to access Polish & 4K Studio.');
              }}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeView === 'studio'
                  ? 'bg-emerald-500 text-black shadow-sm font-semibold'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              3. AI Polish & 4K Upscale
            </button>
          </div>
        </div>

        {/* Global Toolbar Quick Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Recording Mode Toggle */}
          <div className="flex items-center bg-[#202326] p-0.5 rounded-lg border border-[#2e3338]">
            <button
              onClick={() => {
                setRecordMode('video-audio');
                if (!rawVideoStream) initCamera(selectedCameraId);
              }}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                recordMode === 'video-audio' ? 'bg-emerald-500 text-black font-bold' : 'text-[#9ca3af] hover:text-white'
              }`}
              title="Record Video + Studio Audio"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video + Mic</span>
            </button>
            <button
              onClick={() => setRecordMode('audio-only')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                recordMode === 'audio-only' ? 'bg-emerald-500 text-black font-bold' : 'text-[#9ca3af] hover:text-white'
              }`}
              title="Record Studio Audio Only"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Audio Only</span>
            </button>
          </div>

          {/* VU Meter & Gate Indicator */}
          <div className="flex items-center gap-2 bg-[#202326] px-2.5 py-1 rounded-lg border border-[#2e3338]" title="Live Studio Mic Level">
            <span
              className={`w-2 h-2 rounded-full ${
                vuTelemetry.gateOpen ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-[#4b5563]'
              }`}
            />
            <div className="w-16 h-2 bg-[#121416] rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  vuTelemetry.db > -6 ? 'bg-red-500' : vuTelemetry.db > -18 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, ((vuTelemetry.db + 60) / 60) * 100))}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-[#9ca3af] w-8 text-right">
              {Math.round(vuTelemetry.db)}dB
            </span>
          </div>

          {/* Font Size */}
          <div className="hidden md:flex items-center gap-1.5 bg-[#202326] px-2.5 py-1 rounded-lg border border-[#2e3338]">
            <Type className="w-3.5 h-3.5 text-[#9ca3af]" />
            <input
              type="range"
              min="28"
              max="96"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-16 accent-emerald-500 cursor-pointer"
            />
            <span className="text-[10px] text-[#9ca3af] w-6">{fontSize}px</span>
          </div>

          {/* Mirror Toggle */}
          <button
            onClick={() => setMirror(!mirror)}
            className={`px-2 py-1 rounded border text-[11px] transition-colors ${
              mirror ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-[#202326] text-[#9ca3af] border-[#2e3338] hover:text-white'
            }`}
            title="Mirror text horizontally for glass teleprompter hardware"
          >
            Mirror
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-[#202326] hover:bg-[#2e3338] text-[#9ca3af] hover:text-white rounded border border-[#2e3338] transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 bg-[#202326] hover:bg-red-500 text-[#9ca3af] hover:text-white rounded border border-[#2e3338] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT WORKSPACE ────────────────────────────────────────── */}
      <div className="flex-1 bg-[#101214] border-x border-b border-[#2b2f33] rounded-b-xl overflow-hidden flex flex-col relative">

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 1: SETUP, DEVICE SELECTORS, CAMERA BEAUTIFIER & STUDIO MIC
            ══════════════════════════════════════════════════════════════════════ */}
        {activeView === 'setup' && (
          <div className="flex-1 p-6 overflow-y-auto flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
            {/* Left Column: Script Editor & Device Selectors */}
            <div className="flex-1 flex flex-col bg-[#16181a] border border-[#2b2f33] rounded-xl p-5 shadow-xl">
              
              {/* Device Selectors Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 bg-[#121416] border border-[#262a2e] rounded-xl">
                {/* Camera Source Selector */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[#9ca3af] mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      Camera Source:
                    </span>
                    <button onClick={refreshDevices} className="text-[10px] text-emerald-400 hover:underline">
                      Refresh
                    </button>
                  </div>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => handleCameraDeviceChange(e.target.value)}
                    className="w-full bg-[#1e2023] border border-[#343a40] text-white text-xs rounded-lg p-2 focus:outline-none focus:border-emerald-500"
                  >
                    {availableCameras.length > 0 ? (
                      availableCameras.map((cam, idx) => (
                        <option key={cam.deviceId || idx} value={cam.deviceId}>
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))
                    ) : (
                      <option value="">Default Webcam</option>
                    )}
                  </select>
                </div>

                {/* Microphone Source Selector */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[#9ca3af] mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                      Microphone Source:
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">DSP Enhanced</span>
                  </div>
                  <select
                    value={selectedMicId}
                    onChange={(e) => handleMicDeviceChange(e.target.value)}
                    className="w-full bg-[#1e2023] border border-[#343a40] text-white text-xs rounded-lg p-2 focus:outline-none focus:border-emerald-500"
                  >
                    {availableMics.length > 0 ? (
                      availableMics.map((mic, idx) => (
                        <option key={mic.deviceId || idx} value={mic.deviceId}>
                          {mic.label || `Microphone ${idx + 1}`}
                        </option>
                      ))
                    ) : (
                      <option value="">Default Microphone</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Speech Recognition & Word Tracking Mode Selector */}
              <div className="mb-4 p-3.5 bg-[#121416] border border-[#262a2e] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Word Highlighting & Speech Tracking
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#9ca3af]">Speech Language:</span>
                    <select
                      value={speechLanguage}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="bg-[#1e2023] border border-[#343a40] text-emerald-400 text-xs font-semibold rounded-md px-2 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {SPEECH_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {TRACKING_MODES_DEF.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleTrackingModeChange(m.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        trackingMode === m.id
                          ? 'bg-emerald-500/15 border-emerald-500/60 shadow-sm'
                          : 'bg-[#181a1d] border-[#2b2f33] hover:border-[#3c4248]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{m.icon}</span>
                          <span>{m.label}</span>
                        </span>
                        {trackingMode === m.id && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 font-mono text-[9px] rounded font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#9ca3af] leading-tight">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Script Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#2b2f33] mb-3">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-sm">Script & Screenplay Input</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
                  <span>{sentences.length} Sentences</span>
                  <span>•</span>
                  <span>
                    ~{Math.round(sentences.reduce((acc, s) => acc + s.estimatedDurationSec, 0))}s Total Duration
                  </span>
                </div>
              </div>

              {/* Template Quick Pickers */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs text-[#9ca3af]">Quick Templates:</span>
                {SCRIPT_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.title}
                    onClick={() => setScriptText(tmpl.text)}
                    className="px-2.5 py-1 text-xs bg-[#202326] hover:bg-[#2b2f33] border border-[#343a40] rounded-md text-[#d1d5db] transition-colors"
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>

              {/* Script Textarea */}
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Type or paste your script here..."
                className="flex-1 min-h-[160px] bg-[#101214] border border-[#2b2f33] rounded-lg p-4 text-sm text-white/90 leading-relaxed font-mono focus:outline-none focus:border-emerald-500/50 resize-none transition-colors"
              />

              {/* Dialogue Sentence Breakdown Preview */}
              <div className="mt-4 pt-3 border-t border-[#2b2f33]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af] mb-2 flex items-center justify-between">
                  <span>Dialogue Breakdown ({sentences.length} sentences)</span>
                  <span className="text-[11px] text-emerald-400 font-normal">Auto-advances as you speak</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                  {sentences.map((s, idx) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-2.5 p-2 bg-[#121416] hover:bg-[#1a1d20] border border-[#262a2e] rounded-lg text-xs transition-colors"
                    >
                      <span className="px-1.5 py-0.5 bg-[#262a2e] text-emerald-400 font-mono text-[10px] rounded">
                        #{idx + 1}
                      </span>
                      <div className="flex-1">
                        {s.character && (
                          <span className="text-amber-400 font-bold mr-1.5">{s.character}:</span>
                        )}
                        <span className="text-[#e5e7eb]">{s.text}</span>
                      </div>
                      <span className="text-[10px] text-[#6b7280] font-mono shrink-0">
                        {s.words.length}w • {s.estimatedDurationSec}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Studio Camera Beautifier & Studio Mic Racks */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4">
              
              {/* Studio Camera Enhancer Card */}
              <div className="bg-[#16181a] border border-[#2b2f33] rounded-xl p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#2b2f33] mb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-sm">Studio Camera Enhancer</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full">
                    Auto-Beautifier + Denoise
                  </span>
                </div>

                <p className="text-xs text-[#9ca3af] leading-relaxed mb-3">
                  Transforms dull 360p/720p laptop webcams with real-time skin smoothing, low-light de-noising, and studio key-lighting.
                </p>

                {/* Indian Skin Tone Highlight Banner */}
                <div className="mb-3 p-2.5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🇮🇳</span>
                    <div>
                      <div className="text-xs font-bold text-amber-300">Indian & Brown Skin Tone Mode</div>
                      <div className="text-[10px] text-[#9ca3af]">Blemish softener + warm bronze glow (anti-bleaching)</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCameraPresetChange('indian-radiance')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors ${
                      cameraPresetId === 'indian-radiance'
                        ? 'bg-amber-400 text-black shadow'
                        : 'bg-[#202326] text-amber-300 border border-amber-500/40 hover:bg-amber-500/20'
                    }`}
                  >
                    {cameraPresetId === 'indian-radiance' ? '✓ ACTIVE' : 'ACTIVATE'}
                  </button>
                </div>

                {/* Camera Preset Buttons */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {Object.values(STUDIO_VIDEO_PRESETS).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleCameraPresetChange(p.id)}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        cameraPresetId === p.id
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm'
                          : 'bg-[#121416] border-[#262a2e] hover:border-[#383e44]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-xs font-bold text-white truncate">{p.name}</div>
                        {p.id === 'indian-radiance' && (
                          <span className="shrink-0 px-1 py-0.5 bg-amber-500/20 text-amber-300 font-mono text-[8px] rounded font-bold">
                            🇮🇳 BROWN
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#9ca3af] line-clamp-1">{p.description}</div>
                    </button>
                  ))}
                </div>

                {/* Fine-Tune Camera Sliders Collapsible */}
                <div className="border border-[#262a2e] rounded-lg overflow-hidden bg-[#121416]">
                  <button
                    onClick={() => setShowCameraControls(!showCameraControls)}
                    className="w-full flex items-center justify-between p-2.5 text-xs font-semibold text-[#d1d5db] hover:bg-[#1a1d20] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                      Fine-Tune Beautifier, Denoise & Lighting
                    </span>
                    <span className="text-[10px] text-[#9ca3af]">{showCameraControls ? 'Hide' : 'Show'}</span>
                  </button>

                  {showCameraControls && (
                    <div className="p-3 border-t border-[#262a2e] space-y-2.5 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-[#9ca3af]">Auto-Beautifier (Skin Smoothing)</span>
                          <span className="font-mono text-emerald-400">{cameraSettings.skinSmoothing}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={cameraSettings.skinSmoothing}
                          onChange={(e) => handleUpdateCameraSetting('skinSmoothing', Number(e.target.value))}
                          className="w-full accent-emerald-500 h-1.5"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-[#9ca3af]">Face Radiance Glow</span>
                          <span className="font-mono text-emerald-400">{cameraSettings.skinRadiance}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={cameraSettings.skinRadiance}
                          onChange={(e) => handleUpdateCameraSetting('skinRadiance', Number(e.target.value))}
                          className="w-full accent-emerald-500 h-1.5"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-[#9ca3af]">Low-Light Sensor De-Noiser</span>
                          <span className="font-mono text-emerald-400">{cameraSettings.denoise}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={cameraSettings.denoise}
                          onChange={(e) => handleUpdateCameraSetting('denoise', Number(e.target.value))}
                          className="w-full accent-emerald-500 h-1.5"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-[#9ca3af]">Studio Ring/Key Light Fill</span>
                          <span className="font-mono text-emerald-400">{cameraSettings.studioLighting}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={cameraSettings.studioLighting}
                          onChange={(e) => handleUpdateCameraSetting('studioLighting', Number(e.target.value))}
                          className="w-full accent-emerald-500 h-1.5"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Studio Mic DSP Rack Card */}
              <div className="bg-[#16181a] border border-[#2b2f33] rounded-xl p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#2b2f33] mb-3">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-sm">Studio Mic Audio DSP</span>
                  </div>
                  <button
                    onClick={() => handleToggleDsp(!studioMicEnabled)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      studioMicEnabled
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-[#262a2e] text-[#6b7280]'
                    }`}
                  >
                    {studioMicEnabled ? 'DSP ACTIVE' : 'BYPASS'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#121416] border border-[#262a2e] rounded-lg mb-3">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold">Headphone Monitor</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={micMonitoring}
                    onChange={(e) => handleToggleMonitoring(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                {/* Noise Cancellation / Vocal Protection Selector */}
                <div className="mb-3 p-2.5 bg-[#121416] border border-[#262a2e] rounded-lg">
                  <div className="text-[11px] font-semibold text-[#9ca3af] mb-1.5 flex items-center justify-between">
                    <span>Noise Cancellation Filter</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {noiseReductionMode === 'studio-dsp' ? 'Zero-Muffle DSP' : noiseReductionMode}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <button
                      onClick={() => handleNoiseReductionModeChange('studio-dsp')}
                      className={`p-1.5 rounded border text-left transition-colors ${
                        noiseReductionMode === 'studio-dsp'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-[#181a1d] text-[#9ca3af] border-[#2b2f33] hover:text-white'
                      }`}
                      title="Pre-gate sidechain + high-pass filter + acoustic EQ (preserves 100% natural vocal body, zero muffling)"
                    >
                      🎙️ Studio DSP (Zero Muffle)
                    </button>
                    <button
                      onClick={() => handleNoiseReductionModeChange('ai-webrtc')}
                      className={`p-1.5 rounded border text-left transition-colors ${
                        noiseReductionMode === 'ai-webrtc'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-[#181a1d] text-[#9ca3af] border-[#2b2f33] hover:text-white'
                      }`}
                      title="Browser hardware noise cancellation"
                    >
                      🌐 WebRTC AI
                    </button>
                    <button
                      onClick={() => handleNoiseReductionModeChange('both')}
                      className={`p-1.5 rounded border text-left transition-colors ${
                        noiseReductionMode === 'both'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-[#181a1d] text-[#9ca3af] border-[#2b2f33] hover:text-white'
                      }`}
                      title="Both Studio DSP and WebRTC for very loud fans or air conditioners"
                    >
                      ⚡ Hybrid (Both)
                    </button>
                    <button
                      onClick={() => handleNoiseReductionModeChange('off')}
                      className={`p-1.5 rounded border text-left transition-colors ${
                        noiseReductionMode === 'off'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-[#181a1d] text-[#9ca3af] border-[#2b2f33] hover:text-white'
                      }`}
                      title="Raw direct mic without gating"
                    >
                      🔄 Direct / Bypass
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 mb-2">
                  {Object.values(STUDIO_MIC_PRESETS).slice(0, 3).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetChange(preset.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        micPresetId === preset.id
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm'
                          : 'bg-[#121416] border-[#262a2e] hover:border-[#383e44]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${micPresetId === preset.id ? 'text-emerald-400' : 'text-white'}`}>
                          {preset.name}
                        </span>
                        {micPresetId === preset.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Session CTA */}
              <button
                onClick={handleStartSession}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.99]"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>START RECORDING & TELEPROMPTER</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 2: LIVE PROMPTER SESSION (DIALOGUE-BY-DIALOGUE & LIVE VIDEO)
            ══════════════════════════════════════════════════════════════════════ */}
        {activeView === 'prompter' && (
          <div className="flex-1 flex flex-col items-center justify-between p-6 relative overflow-hidden bg-black">

            {/* Live Studio Camera Background (with Beautifier & Lighting) */}
            {recordMode === 'video-audio' && rawVideoStream && (
              <video
                autoPlay
                playsInline
                muted
                ref={(el) => {
                  if (el && rawVideoStream && el.srcObject !== rawVideoStream) {
                    el.srcObject = rawVideoStream;
                  }
                }}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1] z-0"
                style={{ opacity: webcamOpacity / 100 }}
              />
            )}

            {/* Eye Line / Camera Horizon Marker */}
            {showEyeLine && (
              <div className="absolute top-[20%] left-0 w-full flex items-center justify-between px-6 pointer-events-none z-10 opacity-70">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase font-mono">
                    EYE LINE • LOOK AT CAMERA LENS
                  </span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 via-emerald-500/10 to-transparent mx-4" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase font-mono">
                    EYE LINE
                  </span>
                  <span className="w-3 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </div>
              </div>
            )}

            {/* 3-Second Action Countdown Screen */}
            {isCountingDown && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-fade-in">
                <div className="text-8xl font-black text-emerald-400 animate-ping">
                  {countdownVal}
                </div>
                <div className="text-lg font-bold uppercase tracking-widest text-white/80 mt-6">
                  Get Ready to Deliver...
                </div>
              </div>
            )}

            {/* Top Session Progress Bar & Controls */}
            <div className="w-full max-w-4xl flex items-center justify-between z-10 bg-[#16181a]/90 backdrop-blur-md px-4 py-2 rounded-xl border border-[#2b2f33]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                  <span className="font-mono font-bold text-xs text-red-400">
                    {recordMode === 'video-audio' ? 'REC VIDEO + AUDIO' : 'REC AUDIO'}
                  </span>
                  <span className="font-mono text-xs text-white/90">
                    {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:
                    {(elapsedSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="w-px h-4 bg-[#2b2f33]" />

                <span className="text-xs font-semibold text-emerald-400">
                  Sentence {currentSentenceIdx + 1} of {sentences.length}
                </span>
              </div>

              {/* Center Prompter Quick Toggles */}
              <div className="flex items-center gap-3 text-xs">
                {recordMode === 'video-audio' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#9ca3af]">Cam Opacity:</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={webcamOpacity}
                      onChange={(e) => setWebcamOpacity(Number(e.target.value))}
                      className="w-16 accent-emerald-500"
                    />
                  </div>
                )}

                {/* Word Tracking Mode Switcher */}
                <button
                  onClick={() => {
                    const modes: TrackingMode[] = ['voice-follow', 'smart-hybrid', 'auto-pacer'];
                    const nextMode = modes[(modes.indexOf(trackingMode) + 1) % modes.length];
                    handleTrackingModeChange(nextMode);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold border flex items-center gap-1.5 transition-colors ${
                    trackingMode === 'voice-follow'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : trackingMode === 'smart-hybrid'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                  title="Switch between Voice Follow (strict speech delivery), Smart Hybrid, or Auto-Pacer"
                >
                  <span>
                    {trackingMode === 'voice-follow'
                      ? '🎙️ Voice Follow'
                      : trackingMode === 'smart-hybrid'
                      ? '✨ Smart Hybrid'
                      : '⚡ Auto-Pacer'}
                  </span>
                </button>

                {/* Speech Language Selector */}
                <select
                  value={speechLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-[#202326] border border-[#2e3338] text-[11px] text-emerald-400 font-semibold rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  title="Speech Recognition Language"
                >
                  {SPEECH_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowEyeLine(!showEyeLine)}
                  className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors ${
                    showEyeLine ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#202326] text-[#9ca3af]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Eye Line</span>
                </button>

                <label className="flex items-center gap-1.5 text-[#9ca3af] cursor-pointer ml-1">
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span>Auto-Advance</span>
                </label>
              </div>
            </div>

            {/* ── DIALOGUE PRESENTATION CAROUSEL (Word-By-Word) ───────────────── */}
            <div
              className={`flex-1 w-full max-w-4xl flex flex-col justify-center items-center py-8 z-10 transition-transform ${
                mirror ? 'scale-x-[-1]' : ''
              }`}
            >
              {/* Previous Dialogue (Faded above) */}
              {prevSentence && (
                <div className="w-full text-center opacity-30 text-white/50 text-xl font-medium mb-8 transition-opacity duration-300 line-clamp-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono mr-2">
                    ✓ Delivered
                  </span>
                  {prevSentence.text}
                </div>
              )}

              {/* CURRENT ACTIVE DIALOGUE (Center-Stage Focus) */}
              {currentSentence && (
                <div className="w-full text-center relative py-4 transition-all duration-300">
                  {currentSentence.character && (
                    <div className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-400 font-bold text-xs uppercase tracking-wider mb-4">
                      {currentSentence.character}
                    </div>
                  )}

                  {/* Words with progressive highlights */}
                  <div
                    className="font-bold leading-tight tracking-normal transition-all"
                    style={{ fontSize: `${fontSize}px`, lineHeight: 1.35 }}
                  >
                    {currentSentence.words.map((w, wIdx) => {
                      const isCompleted = wIdx < currentWordIdx;
                      const isNext = wIdx === currentWordIdx;

                      if (isCompleted) {
                        return (
                          <span
                            key={w.index}
                            className="text-emerald-400 drop-shadow-[0_2px_8px_rgba(52,211,153,0.3)] transition-colors duration-150 mr-2.5 inline-block"
                          >
                            {w.raw}
                          </span>
                        );
                      } else if (isNext) {
                        return (
                          <span
                            key={w.index}
                            className="bg-amber-400 text-black px-2.5 py-0.5 rounded-lg shadow-[0_0_20px_rgba(251,191,36,0.85)] animate-pulse inline-block mr-2.5 transform scale-105"
                          >
                            {w.raw}
                          </span>
                        );
                      } else {
                        return (
                          <span
                            key={w.index}
                            className="text-white/80 transition-colors duration-150 mr-2.5 inline-block"
                          >
                            {w.raw}
                          </span>
                        );
                      }
                    })}
                  </div>

                  {/* Sentence Completion Progress Bar */}
                  <div className="w-48 h-1 bg-[#262a2e] rounded-full mx-auto mt-6 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-200"
                      style={{
                        width: `${Math.min(
                          100,
                          (currentWordIdx / Math.max(1, currentSentence.words.length)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Upcoming Next Dialogue (Preview below) */}
              {nextSentence && (
                <div className="w-full text-center opacity-40 text-white/60 text-xl font-medium mt-8 transition-opacity duration-300 line-clamp-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/80 font-mono mr-2">
                    Next up
                  </span>
                  {nextSentence.text}
                </div>
              )}
            </div>

            {/* Bottom Floating Control Bar */}
            <div className="w-full max-w-3xl z-20 flex items-center justify-between bg-[#16181a]/95 backdrop-blur-md px-5 py-3 rounded-2xl border border-[#2b2f33] shadow-2xl">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevSentence}
                  disabled={currentSentenceIdx === 0}
                  className="p-2 bg-[#202326] hover:bg-[#2b2f33] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                  title="Previous Sentence (Left Arrow)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={handlePauseToggle}
                  className={`px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-md transition-all ${
                    isRunning
                      ? 'bg-amber-500 hover:bg-amber-600 text-black'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-black'
                  }`}
                  title="Pause / Resume (Spacebar)"
                >
                  {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isRunning ? 'PAUSE' : 'RESUME'}</span>
                </button>

                <button
                  onClick={handleRetakeSentence}
                  className="px-3 py-2 bg-[#202326] hover:bg-[#2b2f33] rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                  title="Retake this sentence (R Key)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Retake</span>
                </button>

                <button
                  onClick={handleNextSentence}
                  className="p-2 bg-[#202326] hover:bg-[#2b2f33] rounded-lg text-white transition-colors"
                  title="Next Sentence (Right Arrow)"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Status & Complete Button */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs text-[#9ca3af]">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-medium text-white">{STUDIO_VIDEO_PRESETS[cameraPresetId].name}</span>
                </div>

                <button
                  onClick={handleFinishSession}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs rounded-lg shadow-md flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>COMPLETE & POLISH</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 3: AI POLISH STUDIO (4K UPSCALER, WHISPER & GEMINI)
            ══════════════════════════════════════════════════════════════════════ */}
        {activeView === 'studio' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full flex flex-col gap-6">

            {/* Studio Header Card */}
            <div className="bg-[#16181a] border border-[#2b2f33] rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-bold text-white">Studio Polish & 4K Clarity Remaster</h3>
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30">
                    Original Saved Safely
                  </span>
                </div>
                <p className="text-xs text-[#9ca3af] mt-1">
                  Enhance your video with AI 4K super-resolution, sharpen webcam details, clean audio pauses, and get Gemini voice coaching.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleDownloadMedia}
                  className="px-4 py-2 bg-[#202326] hover:bg-[#2b2f33] border border-[#343a40] text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Download {upscaledVideoBlob ? '4K Video' : 'Recording'}</span>
                </button>

                <button
                  onClick={handleAddToTimeline}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all transform active:scale-[0.99]"
                >
                  <Film className="w-4 h-4 fill-current" />
                  <span>Add to Timeline Track</span>
                </button>
              </div>
            </div>

            {/* Safety First: SSD Physical Storage & Low-End GPU Guard Status Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-[#16181a] border border-emerald-500/30 rounded-xl shadow-lg">
                <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Physical SSD Storage</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-mono rounded font-semibold">
                      Zero Data Loss
                    </span>
                  </div>
                  <div className="text-[11px] text-[#9ca3af] truncate mt-0.5">
                    {isSavingToSsd
                      ? 'Saving original recording to SSD disk...'
                      : isSavedToSsd
                      ? `Saved to SSD & Downloaded (${savedDiskFilename || 'Take'}) • RAM Cleared`
                      : 'Original preserved safely in local SSD cache & disk download'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#16181a] border border-cyan-500/30 rounded-xl shadow-lg">
                <div className="p-2.5 bg-cyan-500/10 rounded-lg text-cyan-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Low-End GPU Guard (&lt; 400 MB)</span>
                    <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] font-mono rounded font-semibold">
                      Intel HD / Iris Safe
                    </span>
                  </div>
                  <div className="text-[11px] text-[#9ca3af] mt-0.5">
                    Target VRAM: ~{UPSCALE_RESOLUTIONS[upscaleTarget].estimatedGpuVramMb} MB / 400 MB Max
                    {isUpscaling && upscaleProgress && (
                      <span className="text-cyan-300 font-mono ml-1 font-bold">
                        (Live: ~{upscaleProgress.gpuVramMb || UPSCALE_RESOLUTIONS[upscaleTarget].estimatedGpuVramMb} MB)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 4K AI SUPER-RESOLUTION & CLARITY UPSCALER CARD ──────────────── */}
            {recordMode === 'video-audio' && (
              <div className="bg-[#16181a] border border-[#2b2f33] rounded-xl p-5 shadow-xl flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#2b2f33]">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-sm">Lightweight Super-Resolution & Clarity Upscaler</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9ca3af]">Transforms laptop webcam footage up to 4K</span>
                    <span className="px-2 py-0.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono rounded-full font-bold">
                      GPU VRAM &lt; 400 MB
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(['4k', '2k', '1080p'] as UpscaleTargetResolution[]).map((res) => {
                    const spec = UPSCALE_RESOLUTIONS[res];
                    return (
                      <button
                        key={res}
                        onClick={() => setUpscaleTarget(res)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          upscaleTarget === res
                            ? 'bg-emerald-500/15 border-emerald-500/50 shadow-sm'
                            : 'bg-[#121416] border-[#262a2e] hover:border-[#383e44]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{spec.label}</span>
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 font-mono text-[9px] rounded">
                            {spec.badge}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mt-1 font-mono">
                          <span>{spec.width} × {spec.height}</span>
                          <span className="text-cyan-400 font-bold">~{spec.estimatedGpuVramMb} MB VRAM</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Upscaler Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-[#121416] border border-[#262a2e] rounded-lg">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#9ca3af]">Adaptive Edge Sharpening (CAS)</span>
                      <span className="font-mono text-emerald-400">{upscaleSharpness}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={upscaleSharpness}
                      onChange={(e) => setUpscaleSharpness(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#9ca3af]">Micro-Contrast & HDR Depth</span>
                      <span className="font-mono text-emerald-400">{upscaleContrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={upscaleContrast}
                      onChange={(e) => setUpscaleContrast(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5"
                    />
                  </div>
                </div>

                {/* Upscale Progress Bar */}
                {isUpscaling && upscaleProgress && (
                  <div className="p-4 bg-[#121416] border border-emerald-500/30 rounded-lg">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-emerald-400">
                        ⚡ Upscaling to {UPSCALE_RESOLUTIONS[upscaleTarget].label}...
                      </span>
                      <span className="font-mono font-bold text-white">{upscaleProgress.percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#262a2e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-150"
                        style={{ width: `${upscaleProgress.percent}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[#9ca3af] mt-2 flex justify-between">
                      <span>Applying Bicubic Lanczos Super-Sampling + Edge Sharpening</span>
                      <span className="font-mono text-cyan-400">
                        GPU: ~{upscaleProgress.gpuVramMb || UPSCALE_RESOLUTIONS[upscaleTarget].estimatedGpuVramMb} MB / 400 MB Max
                      </span>
                      <span>{upscaleProgress.currentSecond}s / {upscaleProgress.totalSeconds}s</span>
                    </div>
                  </div>
                )}

                {/* Trigger Upscale Button */}
                {!isUpscaling && (
                  <button
                    onClick={handleRunUpscaler}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-400 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {upscaledVideoBlob ? '⚡ Re-Upscale with New Settings' : `⚡ Upscale & Remaster to ${UPSCALE_RESOLUTIONS[upscaleTarget].badge}`}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Video / Audio Player Preview & Split Comparison */}
            <div className="bg-[#16181a] border border-[#2b2f33] rounded-xl p-5 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#9ca3af]">
                  {upscaledVideoUrl ? '4K Remastered Preview (with Before/After Split)' : 'Recorded Master Preview'}
                </span>
                {tightenedSavedSec && (
                  <span className="text-xs text-emerald-400 font-mono">
                    ✓ Dead-air shortened by {tightenedSavedSec}s
                  </span>
                )}
              </div>

              {/* If Video was recorded */}
              {recordMode === 'video-audio' && (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-[420px] flex items-center justify-center border border-[#2b2f33]">
                  {upscaledVideoUrl ? (
                    <div className="relative w-full h-full">
                      {/* Upscaled Video */}
                      <video
                        src={upscaledVideoUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute top-3 left-3 px-2 py-0.5 bg-emerald-500 text-black font-black text-[10px] rounded tracking-wider shadow-lg">
                        {UPSCALE_RESOLUTIONS[upscaleTarget].badge} ACTIVE
                      </div>
                    </div>
                  ) : recordedMediaUrl ? (
                    <video
                      src={recordedMediaUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-[#9ca3af]">No video recorded yet</div>
                  )}
                </div>
              )}

              {/* If Audio-only recorded */}
              {recordMode === 'audio-only' && recordedMediaUrl && (
                <audio
                  src={recordedMediaUrl}
                  controls
                  className="w-full h-12 rounded-lg accent-emerald-500"
                />
              )}

              {/* Quick AI Tools Bar */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleRunWhisperAnalysis}
                  disabled={isAnalyzingWhisper}
                  className="px-4 py-2 bg-[#202326] hover:bg-[#262a2e] border border-[#343a40] text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4 text-emerald-400" />
                  <span>{isAnalyzingWhisper ? 'Whisper Aligning...' : 'Whisper Word Alignment'}</span>
                </button>

                <button
                  onClick={handleTightenSilences}
                  disabled={isTighteningAudio}
                  className="px-4 py-2 bg-[#202326] hover:bg-[#262a2e] border border-[#343a40] text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>{isTighteningAudio ? 'Tightening Dead-Air...' : 'Tighten Awkward Silences'}</span>
                </button>

                <button
                  onClick={handleRunGeminiCoaching}
                  disabled={isCoachingGemini}
                  className="px-4 py-2 bg-[#202326] hover:bg-[#262a2e] border border-[#343a40] text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span>{isCoachingGemini ? 'Gemini Coaching...' : 'Gemini Voice Coaching'}</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('prompter');
                    handleStartSession();
                  }}
                  className="px-3 py-2 text-xs text-[#9ca3af] hover:text-white ml-auto"
                >
                  Record Another Take
                </button>
              </div>
            </div>

            {/* Whisper Alignment & Delivery Score Report */}
            {whisperReport && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#16181a] border border-[#2b2f33] rounded-xl p-4">
                  <div className="text-xs text-[#9ca3af] uppercase font-semibold">Fluency Score</div>
                  <div className="text-3xl font-black text-emerald-400 mt-1">
                    {whisperReport.fluencyScore}%
                  </div>
                  <p className="text-[11px] text-[#9ca3af] mt-1">{whisperReport.pacingFeedback}</p>
                </div>

                <div className="bg-[#16181a] border border-[#2b2f33] rounded-xl p-4">
                  <div className="text-xs text-[#9ca3af] uppercase font-semibold">Reading Cadence</div>
                  <div className="text-3xl font-black text-white mt-1">
                    {whisperReport.paceWpm} <span className="text-sm font-normal text-[#9ca3af]">WPM</span>
                  </div>
                  <p className="text-[11px] text-[#9ca3af] mt-1">
                    {whisperReport.wordCount} words delivered over {whisperReport.durationSec}s.
                  </p>
                </div>

                <div className="bg-[#16181a] border border-[#2b2f33] rounded-xl p-4">
                  <div className="text-xs text-[#9ca3af] uppercase font-semibold">Hesitations & Pauses</div>
                  <div className="text-3xl font-black text-amber-400 mt-1">
                    {whisperReport.fillerWords.length} <span className="text-sm font-normal text-[#9ca3af]">fillers</span>
                  </div>
                  <p className="text-[11px] text-[#9ca3af] mt-1">
                    {whisperReport.longPauses.length} natural breath pauses detected.
                  </p>
                </div>
              </div>
            )}

            {/* Gemini Voice Coaching Box */}
            {geminiCoaching && (
              <div className="bg-[#16181a] border border-teal-500/30 rounded-xl p-5 shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span className="font-bold text-sm text-teal-400">Gemini Voice Director Feedback</span>
                </div>
                <div className="text-xs text-white/90 leading-relaxed whitespace-pre-line font-sans bg-[#101214] p-4 rounded-lg border border-[#262a2e]">
                  {geminiCoaching}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
