import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, Send, Mic, X, Sparkles, Square, Brain, ThumbsUp, ThumbsDown, RefreshCw, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAiCopilot, ChatMessage } from '../hooks/useAiCopilot';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Card } from './ui/card';

interface AiCopilotProps {
  onClose: () => void;
}

export const AiCopilot: React.FC<AiCopilotProps> = ({ onClose }) => {
  const [inputText, setInputText] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
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
    getTrainingStats
  } = useAiCopilot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stats = getTrainingStats();

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
    <div className="fixed bottom-16 right-4 w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-6rem)] bg-background/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden ring-1 ring-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold tracking-tight">AI Copilot</h3>
          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-2">Pro</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-lg hover:bg-white/10"
            onClick={toggleThinkingMode}
            title={isThinking ? "Disable thinking trace" : "Enable thinking trace"}
          >
            {isThinking ? <Brain className="w-4 h-4 text-blue-400" /> : <Brain className="w-4 h-4 text-zinc-600" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-lg hover:bg-white/10"
            onClick={clearChat}
            title="Clear chat history"
          >
            <Trash2 className="w-4 h-4 text-zinc-400" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-white/10" onClick={onClose}>
            <X className="w-4 h-4 text-zinc-400" />
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-4 overflow-y-auto min-h-0" ref={scrollRef}>
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
            
            {isProcessing && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-zinc-300">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 rounded-tl-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            placeholder="Ask AI to edit..."
            className="flex-1 bg-white/5 border-white/10 pr-24 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50"
            disabled={isProcessing || isListening}
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
            >
              {isListening ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              type="submit"
              size="icon"
              className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!inputText.trim() || isProcessing || isListening}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};