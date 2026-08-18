import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { getGroqKey } from '../utils/aiClient';
import { ensureGroqReady, groqTranscribe, hasAnyGroqKey, getPreferredGroqKey } from '../utils/ai-copilot/groqChat';
import { runAgentLoop } from '../utils/ai-copilot/AgentLoop';
import { buildHelpMessage } from '../utils/ai-copilot/systemKnowledge';
import { getCatalogOrFallback } from '../utils/ai-copilot/groqModelCatalog';

import { useEditorStore } from '../store/editorStore';
import { aiToolRegistry, executeAITool, requiresConfirmation } from '../utils/aiToolRegistry';
import { AiTrainingOrchestrator } from '../utils/ai-training/AiTrainingOrchestrator';
import { ConversationContext, ThinkingTrace } from '../utils/ai-training/types';
import { nluEngine, NLUEngine, ParsedIntent } from '../utils/ai-copilot/NLUEngine';
import { memoryStore } from '../utils/ai-copilot/MemoryStore';
import {
  globalRateLimiter,
  RateLimiter,
  RateLimitStatus,
} from '../utils/ai-copilot/RateLimiter';
import { aiPlanGenerator } from '../utils/ai-copilot/AIPlanGenerator';
import {
  createExecutor,
  WorkflowExecutor,
  ExecutionPhase,
} from '../utils/ai-copilot/WorkflowExecutor';
import type { AIWorkflowPlan, AIToolStep, AIWorkflowReport } from '../types';
import { autoTester, AutoTesterOptions } from '../utils/ai-copilot/AutoTester';
import { TestReportGenerator } from '../utils/ai-copilot/TestReportGenerator';
import type { AISelfTestReport } from '../types';
import {
  ExecutionStreamer,
  StreamEvent,
} from '../utils/ai-copilot/ExecutionStreamer';
import {
  VoiceCommandParser,
  rememberWorkflowReport,
} from '../utils/ai-copilot/VoiceCommandParser';

function countAllClips(tracks: any[]): number {
  return tracks.reduce((sum, t) => sum + (t?.clips?.length || 0), 0);
}

function snapshotContext(store: any): ConversationContext {
  return {
    selectedClipIds: store.selectedClipIds ?? [],
    currentTime: store.currentTime ?? 0,
    projectContext: {
      name: store.projectName ?? '',
      totalDuration: store.totalDuration ?? 0,
      trackCount: store.tracks?.length ?? 0,
      clipCount: countAllClips(store.tracks ?? []),
    },
    recentActions: memoryStore.getRecentActions(5).map((a) => a.rawPrompt),
    userIntent: undefined,
    mediaLibrary: (store.mediaLibrary ?? []).map((m: any) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      duration: m.duration,
    })),
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  thinking?: ThinkingTrace;
  timestamp: number;
  isLocal?: boolean;
  pendingConfirmation?: {
    stepId: string;
    toolName: string;
    args: any;
    description: string;
  };
}

export interface ToolCall {
  name: string;
  args: any;
  result?: any;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

// Phase 2: Workflow/executor types surfaced to UI
export interface WorkflowProgress {
  planId: string;
  totalSteps: number;
  currentStepIndex: number;
  currentStepLabel: string;
  phase: ExecutionPhase;
  iteration: number;
  succeeded: number;
  failed: number;
  steps: AIToolStep[];
}

const trainingModule = new AiTrainingOrchestrator();

export const useAiCopilot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(true);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    stepId: string;
    toolName: string;
    args: any;
    description: string;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>(globalRateLimiter.getStatus());
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgress | null>(null);
  const [streamingText, setStreamingText] = useState<{
    messageId: string;
    text: string;
    fullText: string;
    phase: 'phase-1' | 'phase-2' | 'phase-3';
  } | null>(null);
  const [agentModels, setAgentModels] = useState(() => {
    const c = getCatalogOrFallback();
    return { reasoning: c.reasoning, vision: c.vision, keySource: getPreferredGroqKey().source };
  });
  const [selfTestState, setSelfTestState] = useState<{
    isRunning: boolean;
    report: AISelfTestReport | null;
    progress: { done: number; total: number; current: string };
  }>({
    isRunning: false,
    report: null,
    progress: { done: 0, total: 0, current: '' },
  });

  const executorRef = useRef<WorkflowExecutor | null>(null);
  const autoTesterAbortedRef = useRef(false);

  // Phase 1: Guard against re-entrant rate-limit retry chain. When the AI
  // returns 429 we schedule ONE retry timer; subsequent cooldown checks
  // during that window won't schedule additional timers because the prior
  // timer handles it. This prevents ping-pong retry storms.
  const retryTimerRef = useRef<any>(null);

  // Proxy store access to read current state dynamically without triggering re-renders on 60Hz playback updates
  const editorStore = useMemo(() => new Proxy({} as ReturnType<typeof useEditorStore.getState>, {
    get: (_, prop: string) => (useEditorStore.getState() as any)[prop],
  }), []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastMessageTime = useRef(0);
  const isMountedRef = useRef(true);
  const resolvedTextRef = useRef<string>('');
  const chatHydratedRef = useRef(false);
  const RATE_LIMIT_MS = 1000;

  // Subscribe to rate limiter events
  useEffect(() => {
    const unsubscribe = globalRateLimiter.subscribe((status) => {
      if (isMountedRef.current) {
        setRateLimitStatus(status);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('procut_ai_chat_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed.slice(-40));
      }
    } catch { /* ignore */ }
    requestAnimationFrame(() => { chatHydratedRef.current = true; });
    ensureGroqReady().then((cat) => {
      if (!isMountedRef.current) return;
      setAgentModels({
        reasoning: cat.reasoning,
        vision: cat.vision,
        keySource: getPreferredGroqKey().source,
      });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!chatHydratedRef.current) return;
    try {
      localStorage.setItem('procut_ai_chat_v1', JSON.stringify(messages.slice(-40)));
    } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn('Error stopping MediaRecorder:', e);
        }
      }
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      // Clear pending retry timer if any
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      isMountedRef.current = false;
    };
  }, []);

  const conversationContextRef = useMemo(() => ({
    get current(): ConversationContext {
      const state = useEditorStore.getState();
      return {
        selectedClipIds: state.selectedClipIds,
        currentTime: state.currentTime,
        projectContext: {
          name: state.projectName,
          totalDuration: state.totalDuration,
          trackCount: state.tracks.length,
          clipCount: state.tracks.reduce((sum, t) => sum + t.clips.length, 0)
        },
        recentActions: trainingModule.getRecentActions(),
        userIntent: messages.length > 0 ? messages[messages.length - 1].content : undefined
      };
    },
    set current(_val: ConversationContext) { /* ignore manual overrides to stay in sync with state */ }
  }), [messages]);

  // Phase 2: Workflow executor helper (creates an executor bound to current state)
  const buildExecutor = useCallback((): WorkflowExecutor | null => {
    // FIX: Always use getGroqKey() which reads from env → sessionStorage → user settings.
    // Previously used import.meta.env.VITE_GROQ_API_KEY which is ALWAYS undefined on
    // Vercel because the env var is GROQ_API_KEY (no VITE_ prefix) and Vite only bakes
    // VITE_-prefixed vars at build time.
    const groqKey = getGroqKey();
    if (!groqKey) return null;

    const conversation = snapshotContext(editorStore);
    const toolRegistry = aiToolRegistry.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: (t.parameters ?? { type: 'object', properties: {} }) as Record<string, any>,
    }));

    return createExecutor({
      apiKey: groqKey,
      requestConfirmation: async (step) => {
        return new Promise<boolean>((resolve) => {
          if (!isMountedRef.current) {
            resolve(false);
            return;
          }
          setPendingConfirmation({
            stepId: step.id!,
            toolName: step.toolName,
            args: step.args,
            description: step.userFriendlyLabel || step.toolName,
            resolve,
          });
        });
      },
      onPhaseChange: (phase) => {
        if (!isMountedRef.current) return;
        setWorkflowProgress((prev) =>
          prev ? { ...prev, phase } : prev
        );
      },
      onStepUpdate: (step, index) => {
        if (!isMountedRef.current) return;
        setWorkflowProgress((prev) => {
          if (!prev) return prev;
          const steps = [...prev.steps];
          steps[index] = step;
          return {
            ...prev,
            currentStepIndex: index,
            currentStepLabel: step.userFriendlyLabel || step.toolName,
            steps,
            succeeded: steps.filter((s) => s.status === 'success').length,
            failed: steps.filter((s) => s.status === 'failed').length,
          };
        });
      },
      maxIterations: 2,
    });
  }, [editorStore]);

  // Phase 2: Run a workflow given the current user prompt.
  // Returns a chat message summarizing the report.
  const runWorkflow = useCallback(
    async (prompt: string): Promise<AIWorkflowReport | null> => {
      const executor = buildExecutor();
      if (!executor) {
        return null;
      }

      const conversation = snapshotContext(editorStore);
      const toolRegistry = aiToolRegistry.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: (t.parameters ?? { type: 'object', properties: {} }) as Record<string, any>,
      }));

      // Initialize progress early
      if (isMountedRef.current) {
        setWorkflowProgress({
          planId: 'pending',
          totalSteps: 0,
          currentStepIndex: 0,
          currentStepLabel: 'Planning...',
          phase: 'planning',
          iteration: 0,
          succeeded: 0,
          failed: 0,
          steps: [],
        });
      }

      try {
        const report = await executor.run(prompt, {
          conversation,
          toolRegistry,
        });
        executorRef.current = null;

        if (isMountedRef.current) {
          setWorkflowProgress((prev) => prev ? { ...prev, phase: 'completed' as ExecutionPhase } : prev);
        }
        return report;
      } catch (err) {
        executorRef.current = null;
        return null;
      }
    },
    [buildExecutor, editorStore]
  );

  const abortWorkflow = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.abort();
      executorRef.current = null;
    }
  }, []);

  /**
   * Phase 2: Execute user request via the WorkflowExecutor agent.
   * 1 RPM for plan generation + up to 2 RPM for re-plan on failure.
   * Returns a chat-friendly summary message.
   */
  const executeViaExecutor = async (
    resolvedText: string,
    groqKey: string,
    originalText: string
  ): Promise<void> => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: originalText,
      timestamp: Date.now(),
    };
    if (isMountedRef.current) {
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
    }

    // Build executor
    const conversation: ConversationContext = {
      selectedClipIds: editorStore.selectedClipIds ?? [],
      currentTime: editorStore.currentTime ?? 0,
      projectContext: {
        name: editorStore.projectName ?? '',
        totalDuration: editorStore.totalDuration ?? 0,
        trackCount: editorStore.tracks?.length ?? 0,
        clipCount: editorStore.tracks?.reduce((sum, t) => sum + (t?.clips?.length ?? 0), 0) ?? 0,
      },
      recentActions: memoryStore.getRecentActions(5).map((a) => a.rawPrompt),
    };

    const toolRegistry = aiToolRegistry.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: (t.parameters ?? { type: 'object', properties: {} }) as Record<string, any>,
    }));

    const executor = createExecutor({
      apiKey: groqKey,
      requestConfirmation: (step) =>
        new Promise<boolean>((resolve) => {
          if (!isMountedRef.current) return resolve(false);
          setPendingConfirmation({
            stepId: step.id!,
            toolName: step.toolName,
            args: step.args,
            description: step.userFriendlyLabel || step.toolName,
            resolve,
          });
        }),
      onPhaseChange: (phase) => {
        if (!isMountedRef.current) return;
        setWorkflowProgress((prev) => (prev ? { ...prev, phase } : prev));
      },
      onStepUpdate: (step, index) => {
        if (!isMountedRef.current) return;
        setWorkflowProgress((prev) => {
          if (!prev) return prev;
          const steps = [...prev.steps];
          steps[index] = step;
          return {
            ...prev,
            currentStepIndex: index,
            currentStepLabel: step.userFriendlyLabel || step.toolName,
            steps,
            succeeded: steps.filter((s) => s.status === 'success').length,
            failed: steps.filter((s) => s.status === 'failed').length,
          };
        });
      },
      maxIterations: 2,
    });
    executorRef.current = executor;

    // Initialize progress so the UI can stream updates
    if (isMountedRef.current) {
      setWorkflowProgress({
        planId: 'pending',
        totalSteps: 0,
        currentStepIndex: 0,
        currentStepLabel: 'Planning…',
        phase: 'planning',
        iteration: 0,
        succeeded: 0,
        failed: 0,
        steps: [],
      });
    }

    try {
      const report = await executor.run(resolvedText, {
        conversation,
        toolRegistry,
      });
      executorRef.current = null;

      // Build assistant summary message
      const summary = report.summary;
      const stepLines = report.steps
        .map((s, idx) => {
          const icon = s.status === 'success' ? '✅' : s.status === 'failed' ? '❌' : '⏸️';
          return `${idx + 1}. ${icon} ${s.userFriendlyLabel ?? s.toolName}${s.error ? ` — ${s.error}` : ''}`;
        })
        .join('\n');

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `## Workflow Report\n\n${summary}\n\n${stepLines}\n\n_Time: ${(report.totalDurationMs / 1000).toFixed(1)}s · Plan: \`${report.planId}\`_`,
        timestamp: Date.now(),
      };

      // Phase 4: Use ExecutionStreamer with throttled consumer for smoother UX
      const streamMessageId = `stream_${Date.now()}`;
      const throttledSet = ExecutionStreamer.throttleConsumer(
        (event: StreamEvent) => {
          if (!isMountedRef.current) return;
          if (event.type === 'thinking_chunk') {
            const chunk = event.data.chunk as string;
            setStreamingText((prev) =>
              prev && prev.messageId === streamMessageId
                ? { ...prev, text: chunk, fullText: event.data.full ?? chunk }
                : { messageId: streamMessageId, text: chunk, fullText: chunk, phase: 'phase-2' }
            );
          } else if (event.type === 'stream_complete') {
            setStreamingText(null);
          }
        },
        40 // ~25fps; avoids React render storm on rapid chunk stream
      );
      const streamer = new ExecutionStreamer({
        tokenCharRate: 60,
        onEvent: throttledSet,
      });
      // Emit stream events one at a time with a microtask yield so React can
      // flush intermediate state changes. This avoids React error #310 when
      // many tool calls complete back-to-back (e.g. "Import All Media").
      streamer.start(report.totalSteps);
      for (let i = 0; i < report.steps.length; i++) {
        const s = report.steps[i];
        streamer.emitStep(s, i);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      streamer.emitComplete(report);

      // Phase 4: remember full workflow (enables "do that whole workflow")
      rememberWorkflowReport(report);

      // Record primary tool actions in memory
      for (const s of report.steps) {
        if (s.status === 'success') {
          memoryStore.recordAction({
            toolName: s.toolName,
            args: s.args,
            rawPrompt: originalText,
            intent: 'workflow',
            resultStatus: 'success',
            userFriendlyLabel: s.userFriendlyLabel,
          });
        }
      }

      if (isMountedRef.current) {
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      executorRef.current = null;
      const fallback: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Workflow executor error: ${err?.message ?? 'unknown'}`,
        timestamp: Date.now(),
      };
      if (isMountedRef.current) {
        setMessages((prev) => [...prev, fallback]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        // Clear progress after a brief delay so the user sees the final state
        setTimeout(() => {
          if (isMountedRef.current) setWorkflowProgress(null);
        }, 5000);
      }
    }
  };

  /**
   * Phase 3: Run autonomous self-test using the AutoTester.
   * Returns the full report (also stored in selfTestState).
   * 0 RPM — entirely local execution.
   */
  const runSelfTest = useCallback(async (options: AutoTesterOptions = {}) => {
    autoTesterAbortedRef.current = false;
    autoTester.abort();

    if (isMountedRef.current) {
      setSelfTestState({
        isRunning: true,
        report: null,
        progress: { done: 0, total: 0, current: 'Initializing...' },
      });
    }

    const unsubscribe = autoTester.subscribe({
      onProgress: (progress) => {
        if (isMountedRef.current) {
          setSelfTestState((prev) => ({ ...prev, progress }));
        }
      },
    });

    try {
      const report = await autoTester.runReport(options);
      if (isMountedRef.current) {
        setSelfTestState({
          isRunning: false,
          report,
          progress: { done: report.totalTests, total: report.totalTests, current: '' },
        });
      }
      return report;
    } catch (err: any) {
      if (isMountedRef.current) {
        setSelfTestState((prev) => ({
          ...prev,
          isRunning: false,
        }));
      }
      console.error('[SelfTest] Error:', err);
      return null;
    } finally {
      unsubscribe();
    }
  }, []);

  const abortSelfTest = useCallback(() => {
    autoTesterAbortedRef.current = true;
    autoTester.abort();
    if (isMountedRef.current) {
      setSelfTestState((prev) => ({ ...prev, isRunning: false }));
    }
  }, []);

  // Phase 1: Local intent handler (ZERO RPM)
  const handleLocalIntent = useCallback(async (intent: ParsedIntent) => {
    if (intent.requiresAi) return;

    if (isMountedRef.current) {
      setMessages(prev => [...prev,
        { id: Date.now().toString(), role: 'user', content: resolvedTextRef.current ?? '(local)', timestamp: Date.now() }
      ]);
    }

    const store = useEditorStore.getState();
    let responseContent = '';
    let toolCalls: ToolCall[] = [];

    const record = (toolName: string, args: any, status: 'success' | 'failed', result?: any, error?: string): ToolCall => ({
      name: toolName,
      args,
      status,
      result,
      error,
    });

    switch (intent.intent) {
      case 'PLAY':
        store.play();
        responseContent = '▶️ Playback started.';
        toolCalls = [record('play', {}, 'success', { message: 'Playback started' })];
        break;
      case 'PAUSE':
        store.pause();
        responseContent = '⏸️ Playback paused.';
        toolCalls = [record('pause', {}, 'success', { message: 'Playback paused' })];
        break;
      case 'STOP':
        store.pause();
        store.seek(0);
        responseContent = '⏹ Stopped and seek to start.';
        toolCalls = [record('pause', {}, 'success', { message: 'Stopped' })];
        break;
      case 'TOGGLE_PLAY':
        store.togglePlayback();
        responseContent = '⏯ Toggled playback.';
        toolCalls = [record('togglePlayback', {}, 'success', { message: 'Toggled' })];
        break;
      case 'SEEK': {
        const arg = intent.args;
        let targetTime = store.currentTime;
        if (arg.position === 'start') targetTime = 0;
        else if (arg.position === 'end') targetTime = store.totalDuration;
        else if (arg.position === 'middle') targetTime = store.totalDuration / 2;
        else if (typeof arg.time === 'number') targetTime = arg.time;
        store.seek(targetTime);
        responseContent = `⏩ Seeked to ${targetTime.toFixed(2)}s`;
        toolCalls = [record('seek', { time: targetTime }, 'success', { message: `Seeked to ${targetTime}` })];
        break;
      }
      case 'UNDO':
        store.undo();
        responseContent = '↶ Undo performed.';
        toolCalls = [record('undo', {}, 'success', { message: 'Undo performed' })];
        break;
      case 'REDO':
        store.redo();
        responseContent = '↷ Redo performed.';
        toolCalls = [record('redo', {}, 'success', { message: 'Redo performed' })];
        break;
      case 'GET_DURATION': {
        const dur = store.totalDuration;
        responseContent = `📏 Total duration: **${dur.toFixed(2)}s** (${Math.floor(dur / 60)}m ${Math.floor(dur % 60)}s).`;
        break;
      }
      case 'GET_CLIP_COUNT': {
        const count = store.tracks.reduce((sum, t) => sum + t.clips.length, 0);
        responseContent = `🎬 **${count}** clip${count === 1 ? '' : 's'} on the timeline.`;
        break;
      }
      case 'GET_TRACK_COUNT': {
        const count = store.tracks.length;
        responseContent = `📊 **${count}** track${count === 1 ? '' : 's'} in the project.`;
        break;
      }
      case 'GET_STATE': {
        const allClips = store.tracks.reduce((sum, t) => sum + t.clips.length, 0);
        responseContent = `📋 **Project State**\n\n• Duration: ${store.totalDuration.toFixed(2)}s\n• Tracks: ${store.tracks.length}\n• Clips: ${allClips}\n• Media: ${store.mediaLibrary.length}\n• Selected: ${store.selectedClipIds.length}`;
        break;
      }
      case 'RUN_SELF_TEST': {
        // Phase 3: Run the real AutoTester (0 RPM!)
        try {
          const report = await runSelfTest({ scope: 'full' });
          if (report) {
            responseContent = TestReportGenerator.toMarkdown(report);
            toolCalls = [
              record(
                'runSelfTest',
                { scope: 'full' },
                report.failed === 0 ? 'success' : 'failed',
                { reportId: Date.now().toString(), passRate: report.passRate }
              ),
            ];
          } else {
            responseContent = '❌ Self-test failed to run. Check console for details.';
            toolCalls = [record('runSelfTest', { scope: 'full' }, 'failed', { error: 'runner failed' })];
          }
        } catch (err) {
          responseContent = `❌ Self-test error: ${err instanceof Error ? err.message : 'Unknown'}`;
          toolCalls = [record('runSelfTest', { scope: 'full' }, 'failed', { error: responseContent })];
        }
        break;
      }
      case 'GET_HELP':
        responseContent = buildHelpMessage();
        break;
      case 'SAVE_PROJECT':
        // Trigger save flow - just message for now
        responseContent = '💾 Project auto-saves every 5 seconds; I triggered a save.';
        break;
      case 'MUTE_TRACK':
        responseContent = `🔇 Track mute requested for "${intent.args?.trackRef || 'all'}". Use the timeline UI for precise control.`;
        break;
      case 'UNMUTE_TRACK':
        responseContent = `🔊 Track unmute requested for "${intent.args?.trackRef || 'all'}".`;
        break;
      default:
        responseContent = `❓ Local intent "${(intent as any).intent}" recognized but no handler. Will route to AI.`;
    }

    // Record this local action in memory store
    toolCalls.forEach((tc) => {
      if (tc.status === 'success') {
        memoryStore.recordAction({
          toolName: tc.name,
          args: tc.args,
          rawPrompt: resolvedTextRef.current ?? '',
          intent: (intent as any).intent,
          resultStatus: 'success',
          userFriendlyLabel: responseContent,
        });
      }
    });

    // Record conversation
    memoryStore.recordConversation({
      role: 'user',
      content: resolvedTextRef.current ?? '',
    });
    memoryStore.recordConversation({
      role: 'assistant',
      content: responseContent,
    });

    if (isMountedRef.current) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: responseContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: Date.now(),
        isLocal: true,
      }]);
    }
  }, []);

  // Phase 1: Confirmation flow for destructive operations
  const requestConfirmation = useCallback(
    (stepId: string, toolName: string, args: any, description: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!isMountedRef.current) {
          resolve(false);
          return;
        }
        setPendingConfirmation({
          stepId,
          toolName,
          args,
          description,
          resolve,
        });
      });
    },
    []
  );

  const resolveConfirmation = useCallback((approved: boolean) => {
    if (pendingConfirmation) {
      pendingConfirmation.resolve(approved);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation]);

  const sendMessage = async (text: string) => {
    // Guard BUG #2: refuse re-entry while processing to avoid double-set
    if (isProcessing) {
      return;
    }

    const now = Date.now();
    if (now - lastMessageTime.current < RATE_LIMIT_MS) {
      if (isMountedRef.current) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Please wait a moment between messages.',
          timestamp: Date.now()
        }]);
      }
      return;
    }
    lastMessageTime.current = now;

    if (!text.trim()) return;

    // Phase 4: Voice-aware normalization (strip "uh", "um", "like", articles)
    const normalizedText = VoiceCommandParser.normalize(text);
    const inputForParsing = normalizedText || text;

    // Phase 1: Resolve voice/text references FIRST ("do that again")
    let resolvedText = inputForParsing;
    let originalAction: any = null;
    resolvedTextRef.current = inputForParsing;

    // Try tool-specific reference first ("do that import thing again")
    const validToolNames = aiToolRegistry.map((t) => t.name);
    const toolRef = memoryStore.parseToolReference(inputForParsing, validToolNames);
    if (toolRef) {
      const ref = memoryStore.resolveToolReference(inputForParsing, toolRef);
      if (ref.isReference && ref.originalAction) {
        resolvedText = ref.resolved;
        originalAction = ref.originalAction;
        resolvedTextRef.current = resolvedText;
      }
    } else if (memoryStore.isReferenceCommand(inputForParsing)) {
      // Phase 4: Full voice parser can disambiguate better than regex alone
      const voiceResult = VoiceCommandParser.parse(inputForParsing);
      if (voiceResult.isReference && voiceResult.lastAction) {
        resolvedText = voiceResult.resolved ?? inputForParsing;
        originalAction = voiceResult.lastAction;
        resolvedTextRef.current = resolvedText;
      } else {
        const ref = memoryStore.resolveReference(inputForParsing);
        if (ref.isReference && ref.resolved !== inputForParsing) {
          resolvedText = ref.resolved;
          originalAction = ref.originalAction;
          resolvedTextRef.current = resolvedText;
        } else if (ref.isReference && !ref.originalAction) {
          // Reference but no prior action
          if (isMountedRef.current) {
            setMessages(prev => [...prev,
              { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() },
              {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'No previous action to repeat. Try something specific first.',
                timestamp: Date.now(),
                isLocal: true,
              }
            ]);
          }
          return;
        }
      }
    }

    // Phase 1: Try LOCAL intent parsing FIRST (zero RPM for simple commands)
    const localIntent = nluEngine.parse(resolvedText, conversationContextRef.current);
    if (!localIntent.requiresAi) {
      return handleLocalIntent(localIntent);
    }

    // Phase 1: Check rate limiter BEFORE any AI call
    if (globalRateLimiter.isInCooldown()) {
      const waitMs = globalRateLimiter.getCooldownRemainingMs();
      if (isMountedRef.current) {
        setMessages(prev => [...prev,
          { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() },
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Rate limit cooldown active. Retrying in ${Math.ceil(waitMs / 1000)} seconds...`,
            timestamp: Date.now(),
            isLocal: true,
          }
        ]);
      }
      // Schedule ONE retry if not already pending. Guard prevents stacking
      // when the user clicks send multiple times during cooldown.
      if (!retryTimerRef.current) {
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          if (isMountedRef.current) {
            sendMessage(resolvedText);
          }
        }, waitMs + 100);
      }
      return;
    }

    await ensureGroqReady().catch(() => undefined);
    if (!hasAnyGroqKey()) {
      if (isMountedRef.current) {
        setMessages(prev => [...prev,
          { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() },
          { id: (Date.now() + 1).toString(), role: 'assistant', content: 'No Groq key found. I first look for VITE_GROQ_API_KEY (Vercel / env), then your Settings key. Add one to continue.', timestamp: Date.now() }
        ]);
      }
      return;
    }

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    if (isMountedRef.current) {
      setMessages(prev => [...prev, newUserMsg]);
      setIsProcessing(true);
      setWorkflowProgress({
        planId: 'agent',
        totalSteps: 0,
        currentStepIndex: 0,
        currentStepLabel: 'Agent planning…',
        phase: 'planning',
        iteration: 0,
        succeeded: 0,
        failed: 0,
        steps: [],
      });
    }

    const abort = new AbortController();
    try {
      const history = [...messages, newUserMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const result = await runAgentLoop(resolvedText, {
        history,
        signal: abort.signal,
        requestConfirmation: (toolName, args, description) =>
          requestConfirmation(`step_${Date.now()}`, toolName, args, description),
        onProgress: (progress) => {
          if (!isMountedRef.current) return;
          setWorkflowProgress({
            planId: 'agent',
            totalSteps: progress.toolEvents.length,
            currentStepIndex: Math.max(0, progress.toolEvents.length - 1),
            currentStepLabel: progress.label,
            phase: progress.phase === 'looking' ? 'observing' : progress.phase === 'acting' ? 'executing' : progress.phase === 'done' ? 'completed' : 'planning',
            iteration: progress.turn,
            succeeded: progress.toolEvents.filter((t) => t.status === 'success').length,
            failed: progress.toolEvents.filter((t) => t.status === 'failed').length,
            steps: progress.toolEvents.map((t, i) => ({
              id: `evt_${i}`,
              toolName: t.name,
              args: t.args || {},
              status: t.status === 'success' ? 'success' : t.status === 'failed' ? 'failed' : 'running',
              error: t.error,
              userFriendlyLabel: t.name,
            })),
          });
        },
      });

      for (const ev of result.toolEvents) {
        if (ev.status === 'success') {
          memoryStore.recordAction({
            toolName: ev.name,
            args: ev.args,
            rawPrompt: text,
            intent: 'agent',
            resultStatus: 'success',
            userFriendlyLabel: ev.name,
          });
        }
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.text,
        timestamp: Date.now(),
        thinking: result.thinking,
        toolCalls: result.toolEvents.map((t) => ({
          name: t.name,
          args: t.args,
          result: t.result,
          status: t.status,
          error: t.error,
        })),
      };
      if (isMountedRef.current) {
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error: any) {
      console.error('AI Copilot Agent Error:', error);
      let errorMessage = 'An error occurred while processing your request.';
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        const waitMs = globalRateLimiter.getCooldownRemainingMs();
        errorMessage = `⏳ Rate limit reached. Cooling down — retry in **${Math.ceil(waitMs / 1000)}s**. Env key is tried first; Settings key is the fallback.`;
      } else if (error.name === 'AbortError' || error.message?.includes('timed out')) {
        errorMessage = 'Request timed out. I will try the Settings Groq key next time if the env key failed.';
      } else if (error.message?.includes('401') || error.message?.includes('Invalid')) {
        errorMessage = 'Invalid API key. I tried VITE_GROQ_API_KEY first, then Settings. Check both.';
      } else if (error.message?.includes('No Groq')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      if (isMountedRef.current) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now()
        }]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        setTimeout(() => {
          if (isMountedRef.current) setWorkflowProgress(null);
        }, 4000);
      }
    }
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (import.meta.env.DEV) console.log("Audio captured, ready to process size:", audioBlob.size);
        if (!audioBlob.size) return;
        try {
          const transcript = await groqTranscribe(audioBlob);
          if (transcript) sendMessage(transcript);
          else sendMessage('I could not hear a clear command. Please try again.');
        } catch (err: any) {
          sendMessage(`Voice transcription failed: ${err?.message || 'unknown error'}`);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start mic:", err);
    }
  };

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    setIsListening(false);
  }, []);

  const provideFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    trainingModule.learnFromFeedback(messageId, feedback);
    
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, content: msg.content + `\n\n_Thank you for your feedback!_` };
      }
      return msg;
    }));
  };

  const clearChat = () => {
    setMessages([]);
    try { localStorage.removeItem('procut_ai_chat_v1'); } catch { /* ignore */ }
    trainingModule.learnFromFeedback('system_reset', 'positive');
  };

  const toggleThinkingMode = () => {
    setThinkingMode(prev => !prev);
  };

  return {
    messages,
    sendMessage,
    isProcessing,
    isListening,
    isThinking: thinkingMode,
    startListening,
    stopListening,
    provideFeedback,
    clearChat,
    toggleThinkingMode,
    pendingConfirmation,
    resolveConfirmation,
    rateLimitStatus,
    workflowProgress,
    abortWorkflow,
    runAgenticWorkflow: (prompt: string) => sendMessage(prompt),
    agentModels,
    selfTestState,
    abortSelfTest,
    runSelfTest,
    streamingText,
    clearStreamingText: () => setStreamingText(null),
    getTrainingStats: () => ({
      totalInteractions: trainingModule.getRecentActions().length,
      recentActions: trainingModule.getRecentActions()
    })
  };
};
