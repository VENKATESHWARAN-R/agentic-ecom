// CopilotKit runtime endpoint. The agent itself lives in the Python backend
// (backend/src/voltti_backend/agent/) and speaks the AG-UI protocol — this
// route just bridges the frontend to it. Prompt/tool/model changes happen in
// the backend without touching this app.
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";

const AGENT_URL = process.env.AGENT_URL ?? "http://localhost:8000/agui";

const runtime = new CopilotRuntime({
  agents: { default: new HttpAgent({ url: AGENT_URL }) },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
