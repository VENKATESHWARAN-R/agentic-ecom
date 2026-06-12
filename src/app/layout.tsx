import type { Metadata } from "next";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import { SiteFooter, SiteHeader } from "@/components/header";
import { CompareTray } from "@/components/compare-tray";
import { ShoppingAssistant } from "@/components/copilot/shopping-assistant";

export const metadata: Metadata = {
  title: "Voltti — Electronics Store",
  description: "Agentic electronics shopping POC built with Next.js and CopilotKit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          <main className="container">{children}</main>
          <SiteFooter />
          <CompareTray />
          <ShoppingAssistant />
        </Providers>
      </body>
    </html>
  );
}
