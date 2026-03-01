"use client";

import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet, injected, metaMask, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({ shimDisconnect: true }),
    metaMask({ dappMetadata: { name: "AgentCanvas", url: typeof window !== "undefined" ? window.location.origin : "" } }),
    coinbaseWallet({ appName: "AgentCanvas", preference: { options: "all" } }),
    walletConnect({ projectId }),
  ],
  transports: {
    [base.id]: http(),
  },
});
