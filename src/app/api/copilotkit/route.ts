// CopilotKit runtime endpoint — the BFF for the agent. The agent itself lives in
// the Python backend (backend/src/voltti_backend/agent/) and speaks the AG-UI
// protocol. This route resolves the session, mints a short-lived signed identity
// assertion, and forwards to the backend with it attached — so the agent's
// identity-scoped tools (getMyOrders, getReturnInfo) run as the signed-in user
// (P4). Prompt/tool/model changes happen in the backend without touching this app.
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";
import { getSessionPersona, mintAssertion } from "@/lib/session";

const AGENT_URL = process.env.AGENT_URL ?? "http://localhost:8000/agui";

export const POST = async (req: NextRequest) => {
  // Per request: attach the session's identity assertion to the backend agent
  // call. The browser never sets it (it is minted server-side from the httpOnly
  // session), so the model cannot impersonate a user.
  const persona = await getSessionPersona();
  const assertion = await mintAssertion(persona);
  const headers: Record<string, string> = assertion ? { Authorization: `Bearer ${assertion}` } : {};

  const runtime = new CopilotRuntime({
    agents: { default: new HttpAgent({ url: AGENT_URL, headers }) },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
