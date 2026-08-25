import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { NextRequest } from "next/server";
import { createFlowiseAgent } from "@/lib/flowise-adapter";

const apiUrl = process.env.FLOWISE_API_URL;
if (!apiUrl) {
  throw new Error("FLOWISE_API_URL is not set — copy .env.example to .env.local and set it");
}

const flowiseAgent = createFlowiseAgent({
  apiUrl,
  apiKey: process.env.FLOWISE_API_KEY || undefined,
  systemPrompt: process.env.FLOWISE_SYSTEM_PROMPT || undefined,
});

const runtime = new CopilotRuntime({
  agents: { default: flowiseAgent },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
