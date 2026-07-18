import { useState, useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { aiToolRegistry, executeAITool } from '../utils/aiToolRegistry';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  thinking?: ThinkingTrace;
  timestamp: number;
}

export interface ToolCall {
  name: string;
  args: any;
  result?: any;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

export interface ThinkingTrace {
  analysis: string;
  plan: string;
  reasoning: string;
  confidence: number;
}

export interface ConversationContext {
  selectedClipIds: string[];
  currentTime: number;
  projectContext: {
    name: string;
    totalDuration: number;
    trackCount: number;
    clipCount: number;
  };
  recentActions: string[];
  userIntent?: string;
}

interface AITrainingModule {
  analyzeIntent: (userMessage: string, context: ConversationContext) => Promise<{ intent: string; confidence: number; entities: any[] }>;
  generateThinkingTrace: (intent: string, context: ConversationContext, availableTools: any[]) => Promise<ThinkingTrace>;
  validateToolCall: (toolName: string, args: any, context: ConversationContext) => { valid: boolean; error?: string; suggestion?: string };
  learnFromFeedback: (messageId: string, feedback: 'positive' | 'negative') => void;
}

class AITrainingModuleImpl implements AITrainingModule {
  private feedbackHistory: Map<string, 'positive' | 'negative'> = new Map();
  private actionHistory: string[] = [];

  async analyzeIntent(userMessage: string, context: ConversationContext): Promise<{ intent: string; confidence: number; entities: any[] }> {
    const lowerMessage = userMessage.toLowerCase();
    
    const intentPatterns: Array<{ pattern: RegExp; intent: string; baseConfidence: number }> = [
      { pattern: /(add|create|insert|put).*clip/i, intent: 'ADD_CLIP', baseConfidence: 0.85 },
      { pattern: /(delete|remove|cut|ripple delete)/i, intent: 'DELETE_CLIP', baseConfidence: 0.85 },
      { pattern: /(split|cut|divide)/i, intent: 'SPLIT_CLIP', baseConfidence: 0.85 },
      { pattern: /(update|change|modify|edit|adjust)/i, intent: 'UPDATE_CLIP', baseConfidence: 0.75 },
      { pattern: /(play|start|resume)/i, intent: 'PLAY', baseConfidence: 0.9 },
      { pattern: /(pause|stop|halt)/i, intent: 'PAUSE', baseConfidence: 0.9 },
      { pattern: /(seek|jump|go to|move to)/i, intent: 'SEEK', baseConfidence: 0.85 },
      { pattern: /(animate|keyframe|motion|transform)/i, intent: 'ADD_KEYFRAME', baseConfidence: 0.8 },
      { pattern: /(color|grade|filter|effect)/i, intent: 'APPLY_COLOR_EFFECT', baseConfidence: 0.75 },
      { pattern: /(trim|crop|resize)/i, intent: 'TRIM_CLIP', baseConfidence: 0.8 },
    ];

    const entities: any[] = [];
    
    const timeEntityRegex = /(\d+\.?\d*)\s*(s|sec|seconds?|ms|milliseconds?)/i;
    const timeMatch = lowerMessage.match(timeEntityRegex);
    if (timeMatch) {
      const value = parseFloat(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      const seconds = unit.startsWith('ms') ? value / 1000 : value;
      entities.push({ type: 'TIME', value: seconds, raw: timeMatch[0] });
    }

    const clipEntityRegex = /(clip|video|audio|image|text)\s*[:\-]?\s*(\w+)/i;
    const clipMatch = lowerMessage.match(clipEntityRegex);
    if (clipMatch) {
      entities.push({ type: 'CLIP_REFERENCE', mediaType: clipMatch[1], reference: clipMatch[2] });
    }

    const positionEntityRegex = /(start|begin|end|finish|middle|center)/i;
    const positionMatch = lowerMessage.match(positionEntityRegex);
    if (positionMatch) {
      entities.push({ type: 'POSITION', value: positionMatch[1].toLowerCase() });
    }

    for (const { pattern, intent, baseConfidence } of intentPatterns) {
      if (pattern.test(userMessage)) {
        let confidence = baseConfidence;
        
        if (entities.length > 0) {
          confidence = Math.min(0.95, confidence + 0.05 * entities.length);
        }
        
        if (context.selectedClipIds.length > 0 && ['UPDATE_CLIP', 'DELETE_CLIP', 'SPLIT_CLIP', 'ADD_KEYFRAME'].includes(intent)) {
          confidence = Math.min(0.95, confidence + 0.1);
        }

        return { intent, confidence, entities };
      }
    }

    return { 
      intent: 'GENERAL_QUERY', 
      confidence: 0.6,
      entities 
    };
  }

  async generateThinkingTrace(intent: string, context: ConversationContext, availableTools: any[]): Promise<ThinkingTrace> {
    const toolMap = new Map(availableTools.map(t => [t.name, t]));
    
    const analysis = this.generateAnalysis(intent, context);
    const plan = this.generatePlan(intent, context, toolMap);
    const reasoning = this.generateReasoning(intent, analysis, plan);
    const confidence = this.calculateConfidence(intent, context, toolMap);

    return {
      analysis,
      plan,
      reasoning,
      confidence
    };
  }

  private generateAnalysis(intent: string, context: ConversationContext): string {
    const analyses: Record<string, string> = {
      'ADD_CLIP': `User wants to add new content to the timeline. Current project "${context.projectContext.name}" has ${context.projectContext.clipCount} clips across ${context.projectContext.trackCount} tracks.`,
      'DELETE_CLIP': `User wants to remove content. ${context.selectedClipIds.length} clips currently selected. This action will affect timeline duration.`,
      'SPLIT_CLIP': `User wants to divide a clip into segments. Playhead at ${context.currentTime.toFixed(2)}s. Selected clips: ${context.selectedClipIds.length}.`,
      'UPDATE_CLIP': `User wants to modify clip properties. Need to identify target clip(s) and properties to change.`,
      'PLAY': `User wants to preview the timeline. Current position: ${context.currentTime.toFixed(2)}s.`,
      'PAUSE': `User wants to stop playback at current position.`,
      'SEEK': `User wants to navigate to a specific time position.`,
      'ADD_KEYFRAME': `User wants to create animation. Will need to determine interpolation type and easing.`,
      'APPLY_COLOR_EFFECT': `User wants to enhance visual appearance. Need to identify color grading parameters.`,
      'TRIM_CLIP': `User wants to adjust clip boundaries. Need to validate trim points don't exceed media duration.`,
      'GENERAL_QUERY': `User has a general question or request. Need more context to determine specific action.`,
    };

    return analyses[intent] || 'Analyzing user request...';
  }

  private generatePlan(intent: string, context: ConversationContext, toolMap: Map<string, any>): string {
    const plans: Record<string, string> = {
      'ADD_CLIP': '1. Identify media source → 2. Determine target track → 3. Calculate optimal position → 4. Execute addClip tool',
      'DELETE_CLIP': '1. Validate clip exists → 2. Check for dependencies → 3. Execute rippleDeleteClip → 4. Recalculate timeline',
      'SPLIT_CLIP': '1. Validate split point within clip bounds → 2. Execute splitClip at playhead/time → 3. Update UI selection',
      'UPDATE_CLIP': '1. Parse update parameters → 2. Validate property constraints → 3. Execute updateClip → 4. Trigger re-render',
      'PLAY': '1. Check if already playing → 2. Execute play tool → 3. Monitor playback state',
      'PAUSE': '1. Execute pause tool → 2. Preserve current time state',
      'SEEK': '1. Validate time within timeline bounds → 2. Execute seek → 3. Update playhead position',
      'ADD_KEYFRAME': '1. Identify target clip → 2. Parse keyframe values → 3. Validate property paths → 4. Execute addMasterKeyframe',
      'APPLY_COLOR_EFFECT': '1. Parse color parameters → 2. Map to colorFilters schema → 3. Execute updateClip with color values',
      'TRIM_CLIP': '1. Validate trim points → 2. Ensure trimStart < trimEnd → 3. Execute updateClip with trim values',
      'GENERAL_QUERY': '1. Analyze query intent → 2. Provide informational response or suggest actions',
    };

    return plans[intent] || 'Executing standard procedure...';
  }

  private generateReasoning(intent: string, analysis: string, plan: string): string {
    return `${analysis} Strategy: ${plan}`;
  }

  private calculateConfidence(intent: string, context: ConversationContext, toolMap: Map<string, any>): number {
    let confidence = 0.75;

    const requiredTools: Record<string, string[]> = {
      'ADD_CLIP': ['addClip'],
      'DELETE_CLIP': ['rippleDeleteClip'],
      'SPLIT_CLIP': ['splitClip'],
      'UPDATE_CLIP': ['updateClip'],
      'PLAY': ['play'],
      'PAUSE': ['pause'],
      'SEEK': ['seek'],
      'ADD_KEYFRAME': ['addMasterKeyframe'],
      'APPLY_COLOR_EFFECT': ['updateClip'],
      'TRIM_CLIP': ['updateClip'],
    };

    const toolsNeeded = requiredTools[intent] || [];
    const toolsAvailable = toolsNeeded.every(t => toolMap.has(t));
    
    if (!toolsAvailable) {
      confidence -= 0.2;
    }

    if (context.selectedClipIds.length > 0 && ['UPDATE_CLIP', 'DELETE_CLIP', 'SPLIT_CLIP', 'ADD_KEYFRAME'].includes(intent)) {
      confidence += 0.1;
    }

    if (['PLAY', 'PAUSE', 'SEEK'].includes(intent)) {
      confidence += 0.1;
    }

    const recentNegativeFeedback = Array.from(this.feedbackHistory.values()).filter(f => f === 'negative').length;
    if (recentNegativeFeedback > 3) {
      confidence = Math.max(0.5, confidence - 0.1);
    }

    return Math.min(0.95, Math.max(0.5, confidence));
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): { valid: boolean; error?: string; suggestion?: string } {
    const validations: Record<string, (args: any, context: ConversationContext) => { valid: boolean; error?: string; suggestion?: string }> = {
      'addClip': (args, ctx) => {
        if (!args.mediaId) return { valid: false, error: 'mediaId is required' };
        if (!args.trackId) return { valid: false, error: 'trackId is required' };
        if (args.startTime < 0) return { valid: false, error: 'startTime cannot be negative', suggestion: 'Use 0 or positive value' };
        if (args.startTime > ctx.projectContext.totalDuration + 60) {
          return { valid: false, error: 'startTime is beyond reasonable timeline range', suggestion: `Consider ${ctx.projectContext.totalDuration.toFixed(1)}s` };
        }
        return { valid: true };
      },
      'updateClip': (args, ctx) => {
        if (!args.clipId) return { valid: false, error: 'clipId is required' };
        if (!args.updates || typeof args.updates !== 'object') return { valid: false, error: 'updates object is required' };
        return { valid: true };
      },
      'rippleDeleteClip': (args, ctx) => {
        if (!args.clipId) return { valid: false, error: 'clipId is required' };
        return { valid: true };
      },
      'splitClip': (args, ctx) => {
        if (!args.clipId) return { valid: false, error: 'clipId is required' };
        if (args.splitTime !== undefined && args.splitTime < 0) {
          return { valid: false, error: 'splitTime cannot be negative', suggestion: 'Use playhead position or positive time' };
        }
        return { valid: true };
      },
      'seek': (args, ctx) => {
        if (args.time === undefined) return { valid: false, error: 'time is required' };
        if (args.time < 0) return { valid: false, error: 'time cannot be negative' };
        if (args.time > ctx.projectContext.totalDuration * 2) {
          return { valid: false, error: 'time exceeds reasonable timeline length', suggestion: `Timeline is ${ctx.projectContext.totalDuration.toFixed(1)}s` };
        }
        return { valid: true };
      },
      'addMasterKeyframe': (args, ctx) => {
        if (!args.clipId) return { valid: false, error: 'clipId is required' };
        if (args.time === undefined) return { valid: false, error: 'time is required' };
        if (!args.values || typeof args.values !== 'object') return { valid: false, error: 'values object is required' };
        return { valid: true };
      },
    };

    const validator = validations[toolName];
    if (!validator) {
      return { valid: true };
    }

    return validator(args, context);
  }

  learnFromFeedback(messageId: string, feedback: 'positive' | 'negative'): void {
    this.feedbackHistory.set(messageId, feedback);
    
    if (feedback === 'positive') {
      this.actionHistory.push(`✓ Action at ${new Date().toISOString()}`);
    } else {
      this.actionHistory.push(`✗ Action at ${new Date().toISOString()}`);
    }

    if (this.feedbackHistory.size > 100) {
      const entries = Array.from(this.feedbackHistory.entries());
      const toDelete = entries.slice(0, entries.length - 50);
      toDelete.forEach(([key]) => this.feedbackHistory.delete(key));
    }
  }

  getRecentActions(): string[] {
    return this.actionHistory.slice(-10);
  }
}

const trainingModule = new AITrainingModuleImpl();

export const useAiCopilot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(true);
  
  const editorStore = useEditorStore();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const conversationContextRef = useRef<ConversationContext>({
    selectedClipIds: [],
    currentTime: 0,
    projectContext: {
      name: '',
      totalDuration: 0,
      trackCount: 0,
      clipCount: 0
    },
    recentActions: []
  });

  useEffect(() => {
    conversationContextRef.current = {
      selectedClipIds: editorStore.selectedClipIds,
      currentTime: editorStore.currentTime,
      projectContext: {
        name: editorStore.projectName,
        totalDuration: editorStore.totalDuration,
        trackCount: editorStore.tracks.length,
        clipCount: editorStore.tracks.reduce((sum, t) => sum + t.clips.length, 0)
      },
      recentActions: trainingModule.getRecentActions(),
      userIntent: messages.length > 0 ? messages[messages.length - 1].content : undefined
    };
  }, [editorStore.selectedClipIds, editorStore.currentTime, editorStore.projectName, editorStore.totalDuration, editorStore.tracks, messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    // Use Vercel env/session key first, then fallback to user settings
    // @ts-ignore
    const groqKey = import.meta.env.VITE_GROQ_API_KEY || sessionStorage.getItem('procut_groq_key') || editorStore.settings.groqApiKey;
    if (!groqKey) {
      setMessages(prev => [...prev, 
        { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() },
        { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Please configure your Groq API key in the settings to use the AI Copilot.', timestamp: Date.now() }
      ]);
      return;
    }

    const newUserMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newUserMsg]);
    setIsProcessing(true);

    try {
      const { intent, confidence, entities } = await trainingModule.analyzeIntent(
        text,
        conversationContextRef.current
      );

      let thinkingTrace: ThinkingTrace | undefined;
      
      if (thinkingMode) {
        thinkingTrace = await trainingModule.generateThinkingTrace(
          intent,
          conversationContextRef.current,
          aiToolRegistry
        );
      }

      const timelineContext = editorStore.tracks.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        clips: t.clips.map(c => ({
          id: c.id,
          startTime: c.startTime.toFixed(2),
          duration: c.duration.toFixed(2),
          mediaName: editorStore.mediaLibrary.find(m => m.id === c.mediaId)?.name || 'Unknown'
        }))
      }));

      const mediaLibraryContext = editorStore.mediaLibrary.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        duration: m.duration
      }));

      const systemPrompt = `You are a professional Video Editor AI Assistant with advanced reasoning capabilities.

CURRENT PROJECT CONTEXT:
- Project: "${editorStore.projectName}"
- Timeline Duration: ${editorStore.totalDuration.toFixed(2)}s
- Current Playhead: ${editorStore.currentTime.toFixed(2)}s
- Selected Clips: ${editorStore.selectedClipIds.length > 0 ? editorStore.selectedClipIds.join(', ') : 'None'}
- Total Tracks: ${editorStore.tracks.length}
- Total Clips: ${timelineContext.reduce((sum, t) => sum + t.clips.length, 0)}

TIMELINE STATE:
\`\`\`json
${JSON.stringify(timelineContext, null, 2)}
\`\`\`

MEDIA LIBRARY:
\`\`\`json
${JSON.stringify(mediaLibraryContext, null, 2)}
\`\`\`

INTENT ANALYSIS (from AI Training Module):
- Detected Intent: ${intent}
- Confidence: ${(confidence * 100).toFixed(0)}%
- Entities: ${entities.map(e => `${e.type}:${e.value || e.reference}`).join(', ') || 'None'}

${thinkingTrace ? `THINKING TRACE:
Analysis: ${thinkingTrace.analysis}
Plan: ${thinkingTrace.plan}
Reasoning: ${thinkingTrace.reasoning}
Confidence Score: ${(thinkingTrace.confidence * 100).toFixed(0)}%
` : ''}

INSTRUCTIONS:
1. Use the provided tools to manipulate the timeline
2. ALWAYS validate your tool arguments before calling
3. If confidence < 0.7, ask for clarification before executing
4. Target selected clips first, then fall back to clips at playhead position
5. Execute tools and report results with status
6. Learn from feedback to improve future responses

AVAILABLE TOOLS: ${aiToolRegistry.map(t => t.name).join(', ')}`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text }
          ],
          tools: aiToolRegistry.map(tool => ({
            type: 'function',
            function: tool
          })),
          tool_choice: 'auto',
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices[0];
      const message = choice.message;

      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: message.content || '',
        timestamp: Date.now(),
        thinking: thinkingTrace
      };

      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCalls: ToolCall[] = [];
        let aiResponseContent = thinkingMode 
          ? `## Thinking Process\n${thinkingTrace?.reasoning}\n\n## Actions\n` 
          : "I've executed the following actions:\n";
        
        for (const toolCall of message.tool_calls) {
          if (toolCall.type === 'function') {
            const funcName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            
            const validation = trainingModule.validateToolCall(
              funcName,
              args,
              conversationContextRef.current
            );

            if (!validation.valid) {
              toolCalls.push({
                name: funcName,
                args,
                status: 'failed',
                error: validation.error
              });
              aiResponseContent += `- ❌ ${funcName}: Validation failed - ${validation.error}${validation.suggestion ? ` (Suggestion: ${validation.suggestion})` : ''}\n`;
              continue;
            }

            try {
              const result = executeAITool(funcName, args);
              
              toolCalls.push({
                name: funcName,
                args,
                result: result,
                status: result.success ? 'success' : 'failed',
                error: result.error
              });

              if (result.success) {
                aiResponseContent += `- ✅ ${result.message}\n`;
                trainingModule.learnFromFeedback(assistantMsg.id, 'positive');
              } else {
                aiResponseContent += `- ❌ Failed: ${result.error}\n`;
                trainingModule.learnFromFeedback(assistantMsg.id, 'negative');
              }
            } catch (err) {
              toolCalls.push({
                name: funcName,
                args,
                status: 'failed',
                error: err instanceof Error ? err.message : 'Unknown error'
              });
              aiResponseContent += `- ❌ Error executing ${funcName}\n`;
              trainingModule.learnFromFeedback(assistantMsg.id, 'negative');
            }
          }
        }
        
        assistantMsg.toolCalls = toolCalls;
        assistantMsg.content = aiResponseContent;
      }

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error("AI Copilot Error:", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: 'An error occurred while processing your request. Please check your API key and try again.',
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
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

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log("Audio captured, ready to process size:", audioBlob.size);
        sendMessage("Transcribe and execute my voice command (Simulated)");
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start mic:", err);
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsListening(false);
  };

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
    getTrainingStats: () => ({
      totalInteractions: trainingModule.getRecentActions().length,
      recentActions: trainingModule.getRecentActions()
    })
  };
};