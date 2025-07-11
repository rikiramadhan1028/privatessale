'use client'

import './globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { ReactNode } from 'react'

import {
  getDefaultConfig,
  RainbowKitProvider
} from '@rainbow-me/rainbowkit';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { Chain } from 'wagmi/chains';

// 🔧 HOLESKY config
const holesky: Chain = {
  id: 17000,
  name: 'Holesky',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://holesky.gateway.tenderly.co'] },
    public: { http: ['https://holesky.gateway.tenderly.co'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://holesky.etherscan.io' },
  },
  testnet: true,
};

// 🔧 Konfigurasi RainbowKit dan Wagmi
const config = getDefaultConfig({
  appName: 'Chito Presale dApp',
  projectId: '063ec8f564f53c52972e659901652592', 
  chains: [holesky],
  transports: {
    [holesky.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              {children}
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  )
}
