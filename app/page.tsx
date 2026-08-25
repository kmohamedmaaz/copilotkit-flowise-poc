"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

export default function Home() {
  return (
    <main
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <header
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#fff",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#10b981",
            display: "inline-block",
          }}
        />
        <strong>CopilotKit × Flowise POC</strong>
        <span style={{ color: "#6b7280", fontSize: 13 }}>
          Chat interface powered by CopilotKit — agent running in Flowise (app.digiworks.ai)
        </span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <CopilotChat
          labels={{
            welcomeMessageText:
              "Hi! I'm your Flowise agent, now running inside a CopilotKit chat interface. Ask me anything!",
          }}
        />
      </div>
    </main>
  );
}
