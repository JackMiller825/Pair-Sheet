export type ChainConfig = {
  id: string
  name: string
  chainId: number
  gecko: string
  llama: string
  rpcs: string[]
  blockscout: string | null
  routescan: boolean
  explorer: string
}

export const CHAINS: ChainConfig[] = [
  {
    id: "ether",
    name: "Ethereum",
    chainId: 1,
    gecko: "eth",
    llama: "ethereum",
    rpcs: [
      "https://ethereum.publicnode.com",
      "https://rpc.mevblocker.io",
      "https://eth.merkle.io",
    ],
    blockscout: "https://eth.blockscout.com",
    routescan: true,
    explorer: "https://etherscan.io",
  },
  {
    id: "bnb",
    name: "BNB Chain",
    chainId: 56,
    gecko: "bsc",
    llama: "bsc",
    rpcs: ["https://bsc.publicnode.com"],
    blockscout: null,
    routescan: false,
    explorer: "https://bscscan.com",
  },
  {
    id: "polygon",
    name: "Polygon",
    chainId: 137,
    gecko: "polygon_pos",
    llama: "polygon",
    rpcs: ["https://polygon-bor.publicnode.com"],
    blockscout: "https://polygon.blockscout.com",
    routescan: false,
    explorer: "https://polygonscan.com",
  },
  {
    id: "base",
    name: "Base",
    chainId: 8453,
    gecko: "base",
    llama: "base",
    rpcs: ["https://base.publicnode.com"],
    blockscout: "https://base.blockscout.com",
    routescan: false,
    explorer: "https://basescan.org",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    chainId: 42161,
    gecko: "arbitrum",
    llama: "arbitrum",
    rpcs: ["https://arbitrum-one.publicnode.com"],
    blockscout: "https://arbitrum.blockscout.com",
    routescan: false,
    explorer: "https://arbiscan.io",
  },
  {
    id: "optimism",
    name: "Optimism",
    chainId: 10,
    gecko: "optimism",
    llama: "optimism",
    rpcs: ["https://optimism.publicnode.com"],
    blockscout: "https://explorer.optimism.io",
    routescan: false,
    explorer: "https://optimistic.etherscan.io",
  },
  {
    id: "avalanche",
    name: "Avalanche",
    chainId: 43114,
    gecko: "avax",
    llama: "avax",
    rpcs: ["https://avalanche-c-chain.publicnode.com"],
    blockscout: null,
    routescan: true,
    explorer: "https://snowtrace.io",
  },
  {
    id: "linea",
    name: "Linea",
    chainId: 59144,
    gecko: "linea",
    llama: "linea",
    rpcs: ["https://linea.publicnode.com"],
    blockscout: null,
    routescan: false,
    explorer: "https://lineascan.build",
  },
  {
    id: "scroll",
    name: "Scroll",
    chainId: 534352,
    gecko: "scroll",
    llama: "scroll",
    rpcs: ["https://scroll.publicnode.com"],
    blockscout: null,
    routescan: false,
    explorer: "https://scrollscan.com",
  },
  {
    id: "blast",
    name: "Blast",
    chainId: 81457,
    gecko: "blast",
    llama: "blast",
    rpcs: ["https://blast.publicnode.com"],
    blockscout: null,
    routescan: true,
    explorer: "https://blastscan.io",
  },
  {
    id: "zksync",
    name: "zkSync",
    chainId: 324,
    gecko: "zksync",
    llama: "era",
    rpcs: ["https://mainnet.era.zksync.io"],
    blockscout: "https://zksync.blockscout.com",
    routescan: false,
    explorer: "https://explorer.zksync.io",
  },
  {
    id: "celo",
    name: "Celo",
    chainId: 42220,
    gecko: "celo",
    llama: "celo",
    rpcs: ["https://celo.publicnode.com"],
    blockscout: "https://celo.blockscout.com",
    routescan: false,
    explorer: "https://celoscan.io",
  },
  {
    id: "unichain",
    name: "Unichain",
    chainId: 130,
    gecko: "unichain",
    llama: "unichain",
    rpcs: ["https://unichain.publicnode.com"],
    blockscout: "https://unichain.blockscout.com",
    routescan: false,
    explorer: "https://uniscan.xyz",
  },
  {
    id: "worldchain",
    name: "World Chain",
    chainId: 480,
    gecko: "world-chain",
    llama: "wc",
    rpcs: ["https://worldchain-mainnet.g.alchemy.com/public"],
    blockscout: "https://worldchain-mainnet.explorer.alchemy.com",
    routescan: false,
    explorer: "https://worldchain-mainnet.explorer.alchemy.com",
  },
  {
    id: "gnosis",
    name: "Gnosis",
    chainId: 100,
    gecko: "xdai",
    llama: "gnosis",
    rpcs: ["https://gnosis.publicnode.com"],
    blockscout: null,
    routescan: false,
    explorer: "https://gnosisscan.io",
  },
  {
    id: "mantle",
    name: "Mantle",
    chainId: 5000,
    gecko: "mantle",
    llama: "mantle",
    rpcs: ["https://mantle.publicnode.com"],
    blockscout: null,
    routescan: false,
    explorer: "https://mantlescan.xyz",
  },
  {
    id: "metis",
    name: "Metis",
    chainId: 1088,
    gecko: "metis",
    llama: "metis",
    rpcs: ["https://andromeda.metis.io/?owner=1088"],
    blockscout: "https://andromeda-explorer.metis.io",
    routescan: false,
    explorer: "https://andromeda-explorer.metis.io",
  },
  {
    id: "chiliz",
    name: "Chiliz",
    chainId: 88888,
    gecko: "chiliz",
    llama: "chz",
    rpcs: ["https://rpc.chiliz.com"],
    blockscout: null,
    routescan: true,
    explorer: "https://chiliscan.com",
  },
]

const BY_ID = new Map(CHAINS.map((chain) => [chain.id, chain]))

export function getChain(id: string): ChainConfig | undefined {
  return BY_ID.get(id.toLowerCase())
}

export function chainCanExport(chain: ChainConfig): boolean {
  return chain.routescan || Boolean(chain.blockscout)
}

export function supportedChainNames(): string[] {
  return CHAINS.filter(chainCanExport).map((chain) => chain.name)
}
