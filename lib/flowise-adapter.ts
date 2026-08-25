/**
 * Flowise → CopilotKit adapter.
 *
 * CopilotKit (v2, AG-UI based) has no native Flowise connector anymore, so we
 * bridge it with BuiltInAgent "factory mode": our factory streams from the
 * Flowise prediction API (SSE) and translates it into AG-UI events.
 *
 * Flowise SSE wire format (agentflows):
 *   message:
 *   data:{"event":"token","data":"<token delta>"}
 *   ...
 *   data:{"event":"metadata","data":{...}}
 *   data:{"event":"end","data":"[DONE]"}
 */
import { EventType, type BaseEvent } from "@ag-ui/client";
import { BuiltInAgent } from "@copilotkit/runtime/v2";

export interface FlowiseAgentOptions {
  /** Full prediction URL, e.g. https://app.digiworks.ai/api/v1/prediction/<chatflowId> */
  apiUrl: string;
  /** Optional chatflow API key → sent as Authorization: Bearer <key> */
  apiKey?: string;
  /** Optional LLM system prompt injected as the first history message ("" = skip) */
  systemPrompt?: string;
}

interface FlowiseSSEEvent {
  event: string;
  data: unknown;
}

/** Flowise chatId only allows a safe charset — CopilotKit threadIds are UUIDs so this is mostly a no-op safety net. */
function sanitizeChatId(id: string | undefined): string {
  return (id ?? "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100) || "default";
}

/** Extract plain text from an AG-UI message (content can be a string or parts array). */
function textOf(message: { content?: string | unknown[] | null }): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("");
  }
  return String(message?.content ?? "");
}

/** Incremental SSE parser that tolerates Flowise's `message:`/`data:` framing. */
async function* parseFlowiseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<FlowiseSSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const parsed = JSON.parse(payload) as FlowiseSSEEvent;
          yield { event: parsed.event ?? "", data: parsed.data };
        } catch {
          // ignore non-JSON data lines (heartbeats etc.)
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Builds a CopilotKit BuiltInAgent that proxies to a Flowise chatflow/agentflow.
 */
export function createFlowiseAgent({ apiUrl, apiKey, systemPrompt }: FlowiseAgentOptions) {
  return new BuiltInAgent({
    type: "custom",
    factory: async function* ({ input, abortSignal }): AsyncGenerator<BaseEvent> {
      const messages = (input.messages ?? []) as Array<{
        role: string;
        content?: string | unknown[] | null;
      }>;

      // Last user message becomes `question`; everything before it → history.
      let lastUserIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          lastUserIdx = i;
          break;
        }
      }
      if (lastUserIdx === -1) return; // nothing to ask the agent

      const question = textOf(messages[lastUserIdx]);
      const history = messages
        .slice(0, lastUserIdx)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role === "user" ? ("userMessage" as const) : ("apiMessage" as const),
          content: textOf(m),
        }));

      const body: Record<string, unknown> = {
        question,
        chatId: sanitizeChatId(input.threadId),
        streaming: true,
      };
      if (history.length > 0) body.history = history;
      if (systemPrompt) body.overrideConfig = { systemMessage: systemPrompt };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: abortSignal,
      });

      if (!response.ok || !response.body) {
        const errText = await response.text();
        throw new Error(`Flowise API error ${response.status}: ${errText.slice(0, 500)}`);
      }

      const messageId = crypto.randomUUID();
      yield { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" };

      for await (const evt of parseFlowiseSSE(response.body)) {
        if (evt.event === "token" && typeof evt.data === "string" && evt.data.length > 0) {
          yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: evt.data };
        } else if (evt.event === "end") {
          break;
        }
      }

      yield { type: EventType.TEXT_MESSAGE_END, messageId };
    },
  });
}
