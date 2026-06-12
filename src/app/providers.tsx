"use client";

import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { ShopProvider } from "@/lib/shop-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit">
      <ShopProvider>{children}</ShopProvider>
    </CopilotKitProvider>
  );
}
