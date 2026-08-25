/**
 * Mock Flowise prediction server — emulates the exact SSE wire format of
 * Flowise agentflows so the adapter can be tested deterministically offline.
 *
 *   node scripts/mock-flowise.js   (listens on http://localhost:4000)
 *   FLOWISE_API_URL=http://localhost:4000/api/v1/prediction/mock npm run dev
 */
const http = require("http");

const PORT = process.env.MOCK_PORT || 4000;

const TOKENS = [
  "Hello",
  " from",
  " the",
  " mock",
  " Flowise",
  " agent",
  "!",
  " This",
  " is",
  " a",
  " streaming",
  " response",
  " so",
  " you",
  " can",
  " see",
  " tokens",
  " appear",
  " one",
  " by",
  " one",
  ".",
];

function sse(data) {
  return `message:\ndata:${JSON.stringify(data)}\n\n`;
}

const server = http.createServer((req, res) => {
  if (!req.url.includes("/api/v1/prediction/")) {
    res.writeHead(404).end("not found");
    return;
  }

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      /* ignore */
    }

    if (body.streaming) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(sse({ event: "agentFlowEvent", data: "INPROGRESS" }));
      res.write(sse({ event: "nextAgentFlow", data: { nodeId: "startAgentflow_0", status: "INPROGRESS" } }));
      res.write(sse({ event: "token", data: "" }));
      let i = 0;
      const timer = setInterval(() => {
        if (i >= TOKENS.length) {
          clearInterval(timer);
          res.write(
            sse({
              event: "metadata",
              data: {
                chatId: body.chatId || "mock-chat",
                question: body.question,
                followUpPrompts: "[]",
              },
            })
          );
          res.write(sse({ event: "end", data: "[DONE]" }));
          res.end();
          return;
        }
        res.write(sse({ event: "token", data: TOKENS[i] }));
        i++;
      }, 30);
    } else {
      const text =
        TOKENS.join("") +
        ` (non-streaming reply to: ${body.question ?? ""} | history items: ${Array.isArray(body.history) ? body.history.length : 0} | chatId: ${body.chatId ?? "none"})`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ text, question: body.question, chatId: body.chatId || "mock-chat" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Mock Flowise listening on http://localhost:${PORT}`);
});
