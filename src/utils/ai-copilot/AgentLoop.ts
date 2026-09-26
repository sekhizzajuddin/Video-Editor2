/**
 * Agentic observe → plan → act → reflect loop.
 *
 * Uses a reasoning model for tool planning and a vision model when the
 * agent inspects the program monitor. All Groq calls go through groqChat
 * (env key first, settings fallback, 28 RPM cap).
 */

import { executeAITool, requiresConfirmation, aiToolRegistry } from '../aiToolRegistry';
import { groqChat, toOpenAiTools, type GroqChatMessage, type GroqToolCall } from './groqChat';
import { getCatalogOrFallback } from './groqModelCatalog';
import { PROCUT_SYSTEM_KNOWLEDGE, snapshotEditorForAgent, resolveTargetClipId } from './systemKnowledge';
import { globalRateLimiter } from './RateLimiter';

export const AGENT_MAX_TURNS = 4;
export const AGENT_MAX_GROQ_CALLS = 4; // hard cap per user message (plan + reflect + optional vision + wrap-up)
// Always leave this much of the 30 RPM budget unused so a single prompt can
// never consume the whole limit and other features keep working.
export const AGENT_MIN_RPM_HEADROOM = 8;

function rpmHeadroomOk(reserve: number = 0): boolean {
  const status = globalRateLimiter.getStatus();
  return status.canMakeCall && status.remainingCalls - reserve > AGENT_MIN_RPM_HEADROOM;
}

export interface AgentToolEvent {
  name: string;
  args: any;
  status: 'pending' | 'success' | 'failed';
  result?: any;
  error?: string;
}

export interface AgentProgress {
  phase: 'planning' | 'acting' | 'looking' | 'reflecting' | 'done';
  turn: number;
  label: string;
  toolEvents: AgentToolEvent[];
  models: { reasoning: string; vision: string };
  keySource?: string;
}

export interface AgentRunResult {
  text: string;
  toolEvents: AgentToolEvent[];
  thinking?: { analysis: string; plan: string; reasoning: string; confidence: number };
  groqCalls: number;
  models: { reasoning: string; vision: string };
  aborted: boolean;
}

export interface AgentRunOptions {
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  requestConfirmation?: (toolName: string, args: any, description: string) => Promise<boolean>;
  onProgress?: (p: AgentProgress) => void;
  signal?: AbortSignal;
}

function parseArgs(raw: string): any {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return { __parseError: raw };
  }
}

function fillImplicitClip(toolName: string, args: any): any {
  const needsClip = [
    'updateClip',
    'splitClip',
    'rippleDeleteClip',
    'addMasterKeyframe',
    'applyAnimationExpression',
    'moveClip',
    'duplicateClip',
    'selectClip',
  ].includes(toolName);
  if (!needsClip) return args;
  const next = { ...args };
  if (!next.clipId) {
    const id = resolveTargetClipId();
    if (id) next.clipId = id;
  }
  return next;
}

async function capturePreviewJpeg(time?: number): Promise<string | null> {
  const { useEditorStore } = await import('../../store/editorStore');
  const store = useEditorStore.getState();
  const original = store.currentTime;
  if (typeof time === 'number' && Number.isFinite(time)) {
    store.seek(time);
    await new Promise((r) => setTimeout(r, 80));
  }
  const canvas =
    store.previewCanvas ||
    (typeof document !== 'undefined'
      ? (document.getElementById('preview-canvas') as HTMLCanvasElement | null)
      : null);
  let dataUrl: string | null = null;
  try {
    if (canvas && canvas.width > 0) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.55);
    }
  } catch {
    dataUrl = null;
  }
  if (typeof time === 'number' && Math.abs(original - (store.currentTime ?? 0)) > 0.01) {
    store.seek(original);
  }
  return dataUrl;
}

async function visionLook(question: string, dataUrl: string, signal?: AbortSignal): Promise<string> {
  const catalog = getCatalogOrFallback();
  const result = await groqChat({
    purpose: 'vision',
    model: catalog.vision,
    temperature: 0.2,
    maxTokens: 700,
    timeoutMs: 25000,
    signal,
    messages: [
      {
        role: 'system',
        content:
          'You are a professional finishing artist looking at a single video-editor program-monitor frame. Be concrete: composition, subject, color, text readability, problems, and 2-4 specific ProCut edits (transform/color/text/fx) that would improve it. No markdown fences.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: question || 'Describe this frame and recommend edits.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return result.content || 'Vision model returned no description.';
}

export async function runAgentLoop(userText: string, opts: AgentRunOptions = {}): Promise<AgentRunResult> {
  const catalog = getCatalogOrFallback();
  const models = { reasoning: catalog.reasoning, vision: catalog.vision };
  const toolEvents: AgentToolEvent[] = [];
  let groqCalls = 0;
  let aborted = false;

  const emit = (phase: AgentProgress['phase'], turn: number, label: string, keySource?: string) => {
    opts.onProgress?.({ phase, turn, label, toolEvents: [...toolEvents], models, keySource });
  };

  const { compactState } = snapshotEditorForAgent();
  const tools = toOpenAiTools(
    aiToolRegistry.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: (t.parameters ?? { type: 'object', properties: {} }) as Record<string, any>,
    }))
  );

  const historyTail = (opts.history ?? []).slice(-6).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 2000),
  }));

  const messages: GroqChatMessage[] = [
    {
      role: 'system',
      content: `${PROCUT_SYSTEM_KNOWLEDGE}\n\nLIVE PROJECT SNAPSHOT:\n${compactState}\n\nREASONING MODEL: ${models.reasoning}\nVISION MODEL: ${models.vision}\nRPM BUDGET: stay well under 30 requests/minute. Prefer local tools. Call inspectPreview at most once unless the user asks to look again.`,
    },
    ...historyTail,
    { role: 'user', content: userText },
  ];

  emit('planning', 0, 'Planning with reasoning model…');

  for (let turn = 0; turn < AGENT_MAX_TURNS; turn++) {
    if (opts.signal?.aborted) {
      aborted = true;
      break;
    }
    if (groqCalls >= AGENT_MAX_GROQ_CALLS) {
      break;
    }
    if (!globalRateLimiter.canMakeCall()) {
      toolEvents.push({
        name: 'rate_limit',
        args: {},
        status: 'failed',
        error: 'Free-tier cooldown active — wait before another Groq call.',
      });
      break;
    }
    // After the first planning turn, stop reflecting if the RPM budget is
    // getting thin — finish the action with a local summary instead.
    if (turn > 0 && !rpmHeadroomOk()) {
      toolEvents.push({
        name: 'rate_limit',
        args: {},
        status: 'failed',
        error: 'RPM headroom reached — stopping extra planning turns to preserve the budget.',
      });
      break;
    }

    emit('planning', turn + 1, `Reasoning turn ${turn + 1}…`);
    const reply = await groqChat({
      purpose: 'reasoning',
      model: models.reasoning,
      messages,
      tools,
      temperature: 0.2,
      maxTokens: 1800,
      signal: opts.signal,
    });
    groqCalls += 1;

    if (!reply.toolCalls.length) {
      emit('done', turn + 1, 'Done', reply.keySource);
      return {
        text: reply.content || 'Done.',
        toolEvents,
        thinking: {
          analysis: 'Reasoning model produced a final answer.',
          plan: toolEvents.length ? `Executed ${toolEvents.length} tool call(s).` : 'No tools needed.',
          reasoning: reply.content?.slice(0, 400) || '',
          confidence: 0.8,
        },
        groqCalls,
        models,
        aborted,
      };
    }

    messages.push({
      role: 'assistant',
      content: reply.content || '',
      tool_calls: reply.toolCalls,
    });

    emit('acting', turn + 1, `Executing ${reply.toolCalls.length} tool(s)…`, reply.keySource);

    for (const call of reply.toolCalls) {
      if (opts.signal?.aborted) {
        aborted = true;
        break;
      }
      const name = call.function?.name || 'unknown';
      let args = parseArgs(call.function?.arguments || '{}');
      if (args?.__parseError) {
        const ev: AgentToolEvent = {
          name,
          args,
          status: 'failed',
          error: 'Invalid JSON arguments',
        };
        toolEvents.push(ev);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name,
          content: JSON.stringify({ success: false, error: ev.error }),
        });
        continue;
      }

      args = fillImplicitClip(name, args);

      if (requiresConfirmation(name, args) && opts.requestConfirmation) {
        const ok = await opts.requestConfirmation(name, args, `${name} ${JSON.stringify(args).slice(0, 80)}`);
        if (!ok) {
          const ev: AgentToolEvent = { name, args, status: 'failed', error: 'User cancelled' };
          toolEvents.push(ev);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: JSON.stringify({ success: false, error: 'User cancelled' }),
          });
          continue;
        }
      }

      const executed = executeAITool(name, args);
      const ev: AgentToolEvent = {
        name,
        args,
        status: executed.success ? 'success' : 'failed',
        result: executed.result,
        error: executed.error,
      };

      const resAny = executed.result as any;
      if (executed.success && resAny?.__inspectPreview) {
        emit('looking', turn + 1, 'Looking at the preview (vision)…');
        if (groqCalls < AGENT_MAX_GROQ_CALLS && rpmHeadroomOk(1)) {
          const frame = await capturePreviewJpeg(resAny.time);
          if (frame) {
            try {
              const look = await visionLook(resAny.question, frame, opts.signal);
              groqCalls += 1;
              ev.result = { ...resAny, vision: look };
              ev.status = 'success';
              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                name,
                content: JSON.stringify({ success: true, vision: look }),
              });
              toolEvents.push(ev);
              continue;
            } catch (err: any) {
              ev.status = 'failed';
              ev.error = err?.message || 'Vision failed';
            }
          } else {
            ev.status = 'failed';
            ev.error = 'Preview canvas not available';
          }
        } else {
          ev.status = 'failed';
          ev.error = 'RPM budget exhausted before vision';
        }
      }

      toolEvents.push(ev);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name,
        content: JSON.stringify({
          success: executed.success,
          message: executed.message,
          error: executed.error,
          result: executed.result,
        }).slice(0, 4000),
      });
    }

    emit('reflecting', turn + 1, 'Checking results…');
  }

  // Final wrap-up if we still have budget and the last model turn was tools-only.
  // Skip it when the RPM headroom is low — a local summary costs nothing.
  if (!aborted && groqCalls < AGENT_MAX_GROQ_CALLS && rpmHeadroomOk(1)) {
    try {
      const wrap = await groqChat({
        purpose: 'fast',
        messages: [
          ...messages,
          {
            role: 'user',
            content: 'Summarize what you did for the editor user in 2-6 short sentences. No tool calls.',
          },
        ],
        temperature: 0.2,
        maxTokens: 500,
        toolChoice: 'none',
        signal: opts.signal,
      });
      groqCalls += 1;
      emit('done', AGENT_MAX_TURNS, 'Done', wrap.keySource);
      return {
        text: wrap.content || summarizeLocally(toolEvents),
        toolEvents,
        thinking: {
          analysis: 'Agent finished the tool loop.',
          plan: `${toolEvents.filter((t) => t.status === 'success').length} succeeded / ${toolEvents.length} tools.`,
          reasoning: wrap.content?.slice(0, 400) || '',
          confidence: 0.75,
        },
        groqCalls,
        models,
        aborted,
      };
    } catch {
      /* fall through */
    }
  }

  emit('done', AGENT_MAX_TURNS, aborted ? 'Cancelled' : 'Done');
  return {
    text: summarizeLocally(toolEvents),
    toolEvents,
    groqCalls,
    models,
    aborted,
  };
}

function summarizeLocally(events: AgentToolEvent[]): string {
  if (events.length === 0) return 'I could not complete that request. Try rephrasing, or check your Groq API key.';
  const lines = events.map((e) => {
    const icon = e.status === 'success' ? '✅' : '❌';
    return `${icon} ${e.name}${e.error ? ` — ${e.error}` : ''}`;
  });
  return `Here's what I did:\n${lines.join('\n')}`;
}

export function looksVisual(text: string): boolean {
  return /\b(look|see|preview|frame|color|grade|framing|composition|does this look|what do you see|watch)\b/i.test(
    text
  );
}
