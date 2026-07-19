import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, Send, Mic, X, Sparkles, Square, Brain, ThumbsUp, ThumbsDown, RefreshCw, Trash2, Eye, EyeOff, AlertTriangle, Clock } from 'lucide-react';
import { useAiCopilot, ChatMessage } from '../hooks/useAiCopilot';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Card } from './ui/card';
import { TestResultsTable } from './TestResultsTable';
import { globalRateLimiter } from '../utils/ai-copilot/RateLimiter';
import { useRenderGuard } from '../utils/ai-copilot/useRenderGuard';

interface AiCopilotProps {
  onClose: () => void;
}

export const AiCopilot: React.FC<AiCopilotProps> = ({ onClose }) => {
  // Phase 5: Dev-time guard against runaway renders. No-op in normal flow;
  // if any useEffect/setState combo starts looping, this surfaces a clear
  // console message + body[data-runaway] attribute for diagnostics.
  useRenderGuard({ label: 'AiCopilot', windowMs: 1500, maxRenders: 20 });

  const [inputText, setInputText] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const {
    messages,
    sendMessage,
    isProcessing,
    isListening,
    startListening,
    stopListening,
    provideFeedback,
    clearChat,
    toggleThinkingMode,
    isThinking,
    getTrainingStats,
    pendingConfirmation,
    resolveConfirmation,
    rateLimitStatus,
    workflowProgress,
    abortWorkflow,
    selfTestState,
    runSelfTest,
    abortSelfTest,
    streamingText,
  } = useAiCopilot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stats = getTrainingStats();

  // Phase 1: Live cooldown countdown ticker — reads from global rate limiter
  // directly each 1s tick. Bug fix: the closure references `interval`; declare
  // it BEFORE `tick()` runs to avoid TDZ ReferenceError, and avoid setState
  // re-triggering when the local state hasn't actually changed (would
  // otherwise produce an extra render per tick).
  useEffect(() => {
    if (!globalRateLimiter.isInCooldown()) {
      setCooldownSeconds(0);
      return;
    }
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      const remaining = globalRateLimiter.getCooldownRemainingMs();
      const seconds = Math.max(0, Math.ceil(remaining / 1000));
      setCooldownSeconds((prev) => (prev === seconds ? prev : seconds));
      if (seconds <= 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    tick();
    intervalId = setInterval(tick, 1000);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [rateLimitStatus.isInCooldown]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      sendMessage(inputText);
      setInputText('');
    }
  };

  const toggleThinking = (messageId: string) => {
    const newSet = new Set(expandedThinking);
    if (newSet.has(messageId)) {
      newSet.delete(messageId);
    } else {
      newSet.add(messageId);
    }
    setExpandedThinking(newSet);
  };

  const toggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const renderThinkingTrace = (msg: ChatMessage) => {
    if (!msg.thinking) return null;
    const isExpanded = expandedThinking.has(msg.id);

    return (
      <Card className="mt-2 p-3 bg-blue-900/20 border-blue-800/30 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-blue-300">AI Thinking Process</span>
          <span className="ml-auto text-blue-400">Confidence: {(msg.thinking.confidence * 100).toFixed(0)}%</span>
        </div>
        
        {isExpanded ? (
          <div className="space-y-2 text-blue-100">
            <div>
              <span className="font-semibold text-blue-300">Analysis:</span>
              <p className="mt-1 text-blue-200">{msg.thinking.analysis}</p>
            </div>
            <div>
              <span className="font-semibold text-blue-300">Plan:</span>
              <p className="mt-1 text-blue-200">{msg.thinking.plan}</p>
            </div>
            <div>
              <span className="font-semibold text-blue-300">Reasoning:</span>
              <p className="mt-1 text-blue-200">{msg.thinking.reasoning}</p>
            </div>
          </div>
        ) : (
          <p className="text-blue-200 line-clamp-2">{msg.thinking.reasoning}</p>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-6 text-blue-300 hover:text-blue-100"
          onClick={() => toggleThinking(msg.id)}
        >
          {isExpanded ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
          {isExpanded ? 'Hide' : 'Show'} Thinking
        </Button>
      </Card>
    );
  };

  const renderToolCalls = (msg: ChatMessage) => {
    if (!msg.toolCalls || msg.toolCalls.length === 0) return null;

    return (
      <div className="mt-2 space-y-1">
        {msg.toolCalls.map((toolCall, idx) => (
          <div 
            key={idx}
            className={`text-xs p-2 rounded border ${
              toolCall.status === 'success' 
                ? 'bg-green-900/20 border-green-800/30 text-green-200' 
                : toolCall.status === 'failed'
                ? 'bg-red-900/20 border-red-800/30 text-red-200'
                : 'bg-yellow-900/20 border-yellow-800/30 text-yellow-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toolCall.status === 'success' ? (
                <span className="text-green-400">✓</span>
              ) : toolCall.status === 'failed' ? (
                <span className="text-red-400">✗</span>
              ) : (
                <span className="text-yellow-400">⟳</span>
              )}
              <span className="font-mono">{toolCall.name}</span>
              {toolCall.error && (
                <span className="text-red-300 ml-auto">Error: {toolCall.error}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="fixed bottom-16 right-4 w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-6rem)] bg-background/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden ring-1 ring-white/5"
      role="region"
      aria-label="AI Copilot Assistant"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-5 h-5" aria-hidden="true" />
          <h3 className="font-semibold tracking-tight">AI Copilot</h3>
          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-2" aria-label="Pro tier">Pro</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-lg hover:bg-white/10"
            onClick={toggleThinkingMode}
            title={isThinking ? "Disable thinking trace" : "Enable thinking trace"}
            aria-label={isThinking ? "Disable thinking trace" : "Enable thinking trace"}
            aria-pressed={isThinking}
          >
            {isThinking ? <Brain className="w-4 h-4 text-blue-400" /> : <Brain className="w-4 h-4 text-zinc-600" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-lg hover:bg-white/10"
            onClick={() => {
              if (selfTestState.isRunning) abortSelfTest();
              else void runSelfTest({ scope: 'full' });
            }}
            title={selfTestState.isRunning ? 'Stop self-test' : 'Run full self-test (50+ tests)'}
            aria-label={selfTestState.isRunning ? 'Stop self-test' : 'Run full self-test'}
            aria-busy={selfTestState.isRunning}
          >
            <Sparkles className={`w-4 h-4 ${selfTestState.isRunning ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-lg hover:bg-white/10"
            onClick={clearChat}
            title="Clear chat history"
            aria-label="Clear chat history"
          >
            <Trash2 className="w-4 h-4 text-zinc-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-full hover:bg-white/10"
            onClick={onClose}
            aria-label="Close AI Copilot"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </Button>
        </div>
      </div>

      {/* Phase 1: Rate Limit Banner / Cooldown */}
      {(rateLimitStatus.isInCooldown || rateLimitStatus.remainingCalls <= 5) && (
        <div className={`px-3 py-2 border-b border-white/10 text-xs flex items-center gap-2 ${
          rateLimitStatus.isInCooldown
            ? 'bg-red-900/30 text-red-200'
            : 'bg-amber-900/20 text-amber-200'
        }`}>
          <Clock className="w-3.5 h-3.5" />
          {rateLimitStatus.isInCooldown ? (
            <span>
              ⏳ Rate limit cooldown — auto-retry in <strong>{cooldownSeconds}s</strong>
            </span>
          ) : (
            <span>
              ⚠️ Only <strong>{rateLimitStatus.remainingCalls}</strong> API call{rateLimitStatus.remainingCalls === 1 ? '' : 's'} left this minute
            </span>
          )}
        </div>
      )}

      {/* Phase 1: Confirmation Modal for destructive operations */}
      {pendingConfirmation && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
          <Card className="max-w-sm w-[90%] p-4 bg-zinc-900 border-amber-500/40 border-2 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-amber-200">Confirm Destructive Action</h4>
                <p className="mt-1 text-sm text-zinc-300">
                  AI wants to execute{' '}
                  <code className="text-amber-300 font-mono bg-amber-900/20 px-1 rounded">
                    {pendingConfirmation.toolName}
                  </code>
                </p>
                <pre
                  className="mt-2 text-xs bg-black/40 p-2 rounded border border-white/10 overflow-x-auto max-h-24 overflow-y-auto text-zinc-300"
                  aria-label="Tool arguments"
                >
                  {JSON.stringify(pendingConfirmation.args, null, 2).slice(0, 200)}
                </pre>
                <p className="text-xs text-zinc-500 mt-2">{pendingConfirmation.description}</p>
                <p className="text-[10px] text-zinc-600 mt-2">
                  You can always undo with <kbd className="font-mono bg-zinc-800 px-1 py-0.5 rounded">Ctrl+Z</kbd> after.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resolveConfirmation(false)}
                className="text-zinc-400 hover:text-zinc-200"
                aria-label="Cancel destructive action"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => resolveConfirmation(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white"
                aria-label="Approve destructive action"
              >
                Approve
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Chat Area */}
      <div
        className="flex-1 p-4 overflow-y-auto min-h-0"
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="AI Copilot conversation log"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 space-y-4">
            <Bot className="w-12 h-12 text-zinc-700" />
            <div>
              <p className="font-medium text-zinc-300">How can I help you edit?</p>
              <p className="text-sm mt-1">Try "Add a cinematic zoom to the selected clip" or "Split the clip here"</p>
            </div>
            {stats.totalInteractions > 0 && (
              <div className="mt-4 text-xs text-zinc-600">
                <p>Total interactions: {stats.totalInteractions}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-zinc-300'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-[80%] text-sm ${msg.role === 'user' ? '' : 'flex-1'}`}>
                  <div className={`px-4 py-2 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-primary/20 text-primary-foreground rounded-tr-sm' 
                      : 'bg-white/5 text-zinc-200 border border-white/10 rounded-tl-sm whitespace-pre-line'
                  }`}>
                    {msg.content}
                  </div>

                  {msg.role === 'assistant' && msg.isLocal && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Local · 0 API calls
                    </div>
                  )}

                  {msg.role === 'assistant' && (
                    <>
                      {msg.thinking && renderThinkingTrace(msg)}
                      {msg.toolCalls && renderToolCalls(msg)}
                      
                      <div className="flex gap-1 mt-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-zinc-500 hover:text-green-400 hover:bg-green-900/20"
                          onClick={() => provideFeedback(msg.id, 'positive')}
                          title="Helpful"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
                          onClick={() => provideFeedback(msg.id, 'negative')}
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            
            {isProcessing && !streamingText && (
              <div className="flex gap-3" role="status" aria-label="AI is processing">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-zinc-300">
                  <Bot className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 rounded-tl-sm flex items-center gap-1.5" aria-label="Loading">
                  <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Phase 4: Live streaming text (typewriter effect) */}
            {streamingText && (
              <div className="flex gap-3" role="status" aria-label="AI response streaming">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-zinc-300">
                  <Bot className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 rounded-tl-sm flex-1 min-w-0">
                  <pre className="font-sans text-sm text-zinc-200 whitespace-pre-wrap break-words overflow-hidden">
                    {streamingText.text}
                    <span className="inline-block w-1.5 h-4 bg-zinc-400 ml-1 align-middle animate-pulse" aria-hidden="true" />
                  </pre>
                </div>
              </div>
            )}

            {/* Phase 2: Live Workflow Progress Card */}
            {workflowProgress && workflowProgress.totalSteps > 0 && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-300">
                  <span className="text-xs">⚙️</span>
                </div>
                <div className="flex-1 rounded-xl bg-blue-900/15 border border-blue-500/30 p-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-blue-200 flex items-center gap-1.5">
                      <span className="capitalize">{workflowProgress.phase}</span>
                      <span className="text-blue-400/60">·</span>
                      <span>{workflowProgress.currentStepLabel}</span>
                    </div>
                    <span className="text-blue-400">
                      {workflowProgress.succeeded}/{workflowProgress.totalSteps}
                    </span>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {workflowProgress.steps.map((s, i) => (
                      <div
                        key={s.id || i}
                        className={`h-1 flex-1 rounded-full ${
                          s.status === 'success'
                            ? 'bg-emerald-400'
                            : s.status === 'failed'
                            ? 'bg-red-400'
                            : s.status === 'running'
                            ? 'bg-blue-400 animate-pulse'
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-zinc-400 hover:text-red-300"
                    onClick={abortWorkflow}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Stop
                  </Button>
                </div>
              </div>
            )}

            {/* Phase 3: Self-Test Results — shown when a recent run is in progress or completed */}
            {(selfTestState.isRunning || selfTestState.report) && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-indigo-500/20 text-indigo-300">
                  <span className="text-xs">🧪</span>
                </div>
                <div className="flex-1">
                  <TestResultsTable
                    report={selfTestState.report}
                    isRunning={selfTestState.isRunning}
                    currentTest={selfTestState.progress.current}
                    progress={{ done: selfTestState.progress.done, total: selfTestState.progress.total }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-black/40 border-t border-white/10">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              rateLimitStatus.isInCooldown
                ? `Cooldown — retry in ${cooldownSeconds}s...`
                : pendingConfirmation
                ? 'Confirm or cancel the pending action above...'
                : 'Ask AI to edit (try "play", "test everything", "add text Hello")...'
            }
            className="flex-1 bg-white/5 border-white/10 pr-24 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50"
            disabled={isProcessing || isListening || !!pendingConfirmation}
            aria-label="AI Copilot message input"
            aria-disabled={isProcessing || isListening || !!pendingConfirmation}
          />

          <div className="absolute right-1 flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={`w-8 h-8 rounded-lg transition-colors ${
                isListening
                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
              }`}
              onClick={toggleListen}
              disabled={isProcessing}
              title="Voice Command"
              aria-label={isListening ? 'Stop voice capture' : 'Start voice command'}
              aria-pressed={isListening}
            >
              {isListening ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              type="submit"
              size="icon"
              className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!inputText.trim() || isProcessing || isListening}
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};