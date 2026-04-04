import { http, createConfig } from "wagmi";
import { base, polygon } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base, polygon],
  connectors: [
    coinbaseWallet({ appName: "Tales of Tasern" }),
    injected(),
    walletConnect({ projectId: "e3106d04db9686914d9be6d786a50aa7" }),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL),
    [polygon.id]: http(),
  },
  ssr: true,
});
