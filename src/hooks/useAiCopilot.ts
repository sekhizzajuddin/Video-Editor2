import { useState, useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { aiToolRegistry, executeAITool } from '../utils/aiToolRegistry';
import { AiTrainingOrchestrator } from '../utils/ai-training/AiTrainingOrchestrator';
import { ConversationContext, ThinkingTrace } from '../utils/ai-training/types';

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

const trainingModule = new AiTrainingOrchestrator();

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
          model: 'llama-3.3-70b-versatile',
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