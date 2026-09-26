import { useState, useRef, useCallback, useEffect } from 'react';
import { GeminiLiveClient, LiveFunctionCall, LiveFunctionResponse } from '../utils/geminiLiveClient';
import { aiToolRegistry, executeAITool } from '../utils/aiToolRegistry';
import { toast } from 'sonner';

export interface UseGeminiLiveReturn {
  isLiveConnected: boolean;
  isConnecting: boolean;
  liveTranscript: string;
  error: string | null;
  startLiveSession: () => Promise<void>;
  stopLiveSession: () => void;
  toggleLiveSession: () => Promise<void>;
}

export function useGeminiLiveCopilot(): UseGeminiLiveReturn {
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<GeminiLiveClient | null>(null);
  const frameIntervalRef = useRef<any>(null);

  const stopLiveSession = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsLiveConnected(false);
    setIsConnecting(false);
  }, []);

  const startLiveSession = useCallback(async () => {
    if (clientRef.current?.connected) return;

    try {
      setIsConnecting(true);
      setError(null);

      const client = new GeminiLiveClient();
      clientRef.current = client;

      // Prepare Gemini function declarations
      const tools = [
        {
          functionDeclarations: aiToolRegistry.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      ];

      const systemInstruction = `You are the ProCut AI Live Video Director and System Auditor.
You are directly observing the user's video editor preview canvas in real-time, hearing their voice commands, and having hands-on control over the timeline.
CRITICAL NLE ARCHITECTURE:
ProCut has unique internal workflows that differ from CapCut and Premiere Pro:
- Speed Ramping is implemented via "Speed Frames" (speedFrames), NOT razor cuts.
- Animations use "addMasterKeyframe" with structured multi-property payloads, or "applyAnimationExpression".
- When unsure of ProCut's exact implementation or tool payload for any feature, call "searchAppCapabilities" or "runProcutCLI(command='docs <topic>')" to inspect the official internal specification!
RULES:
1. When asked to cut, add B-roll, add keyframes, or modify clips, call the appropriate tool immediately.
2. When asked to audit the editor or check for bugs, call the "auditEditorSystem" tool and explain your findings clearly.
3. Be conversational, professional, concise, and helpful like a seasoned Hollywood editor.`;


      // Set up callbacks
      client.onTextResponse = (text) => {
        setLiveTranscript((prev) => (prev ? `${prev} ${text}` : text));
      };

      client.onToolCall = async (calls: LiveFunctionCall[]): Promise<LiveFunctionResponse[]> => {
        const responses: LiveFunctionResponse[] = [];
        for (const call of calls) {
          try {
            toast.info(`AI executing: ${call.name}`);
            const result = executeAITool(call.name, call.args);
            responses.push({ id: call.id, response: result });
          } catch (err: any) {
            responses.push({ id: call.id, response: { success: false, error: err?.message || 'Execution error' } });
          }
        }
        return responses;
      };

      client.onClose = () => {
        setIsLiveConnected(false);
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
          frameIntervalRef.current = null;
        }
      };

      client.onError = (err) => {
        const msg = err?.message || 'Gemini Live WebSocket connection failed';
        setError(msg);
        toast.error(msg);
        stopLiveSession();
      };

      // Connect
      await client.connect({
        systemInstruction,
        tools,
      });

      // Start streaming microphone
      await client.startMicStream();

      // Start streaming preview canvas at 1 fps
      frameIntervalRef.current = setInterval(() => {
        if (!client.connected) return;

        const canvas = (document.getElementById('preview-canvas') || document.querySelector('canvas')) as HTMLCanvasElement | null;
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            client.sendFrame(dataUrl);
          } catch {
            // ignore frame capture errors (e.g. CORS or canvas context loss)
          }
        }
      }, 1000);

      setIsLiveConnected(true);
      toast.success('Gemini Live Director connected: Watching canvas & listening to mic');
    } catch (err: any) {
      const msg = err?.message || 'Failed to start Gemini Live Copilot';
      setError(msg);
      toast.error(msg);
      stopLiveSession();
    } finally {
      setIsConnecting(false);
    }
  }, [stopLiveSession]);

  const toggleLiveSession = useCallback(async () => {
    if (isLiveConnected) {
      stopLiveSession();
    } else {
      await startLiveSession();
    }
  }, [isLiveConnected, startLiveSession, stopLiveSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, [stopLiveSession]);

  return {
    isLiveConnected,
    isConnecting,
    liveTranscript,
    error,
    startLiveSession,
    stopLiveSession,
    toggleLiveSession,
  };
}
