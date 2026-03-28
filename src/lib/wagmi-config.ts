import { http, createConfig } from "wagmi";
import { base, polygon } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base, polygon],
  connectors: [
    coinbaseWallet({ appName: "Tales of Tasern" }),
    injected(),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL),
    [polygon.id]: http(),
  },
  ssr: true,
});
