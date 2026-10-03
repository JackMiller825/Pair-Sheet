import type { ChainConfig } from "./chains"
import { fetchJson, mapPool } from "./http"

export type ContractInfo = {
  contract: boolean
  verified: boolean
}

export type WalletLookup = {
  contracts: Record<string, ContractInfo>
  deployer: string | null
  failed: string[]
}

type AddressBody = {
  is_contract?: boolean
  is_verified?: boolean
  creator_address_hash?: string | null
}

// Whether an address is a contract and whether its source is published. Routers
// from known DEXes are verified; private MEV and sniper contracts almost never are.
async function contractInfo(chain: ChainConfig, address: string): Promise<ContractInfo> {
  if (chain.blockscout) {
    const body = (await fetchJson(`${chain.blockscout}/api/v2/addresses/${address}`, undefined, 10000, 1)) as AddressBody
    return { contract: Boolean(body.is_contract), verified: Boolean(body.is_verified) }
  }
  const params = new URLSearchParams({ module: "contract", action: "getsourcecode", address })
  const body = (await fetchJson(routescanUrl(chain, params), undefined, 10000, 1)) as { result?: unknown }
  const row = Array.isArray(body.result) ? (body.result[0] as Record<string, unknown> | undefined) : undefined
  if (!row) throw new Error("No answer from the explorer")
  const verified = typeof row.SourceCode === "string" && row.SourceCode.length > 0
  return { contract: true, verified }
}

async function tokenDeployer(chain: ChainConfig, token: string): Promise<string | null> {
  if (chain.blockscout) {
    const body = (await fetchJson(`${chain.blockscout}/api/v2/addresses/${token}`, undefined, 10000, 1)) as AddressBody
    return body.creator_address_hash ? body.creator_address_hash.toLowerCase() : null
  }
  const params = new URLSearchParams({ module: "contract", action: "getcontractcreation", contractaddresses: token })
  const body = (await fetchJson(routescanUrl(chain, params), undefined, 10000, 1)) as { result?: unknown }
  const row = Array.isArray(body.result) ? (body.result[0] as Record<string, unknown> | undefined) : undefined
  const creator = row && typeof row.contractCreator === "string" ? row.contractCreator : ""
  return creator ? creator.toLowerCase() : null
}

function routescanUrl(chain: ChainConfig, params: URLSearchParams): string {
  if (!chain.routescan) throw new Error("No explorer API for this chain")
  return `https://api.routescan.io/v2/network/mainnet/evm/${chain.chainId}/etherscan/api?${params}`
}

export async function lookUpWallets(
  chain: ChainConfig,
  addresses: string[],
  token: string | null,
): Promise<WalletLookup> {
  const contracts: Record<string, ContractInfo> = {}
  const failed: string[] = []
  let deployer: string | null = null

  await Promise.all([
    mapPool(addresses, 3, async (address) => {
      try {
        contracts[address.toLowerCase()] = await contractInfo(chain, address)
      } catch {
        failed.push(address.toLowerCase())
      }
    }),
    token
      ? tokenDeployer(chain, token)
          .then((value) => {
            deployer = value
          })
          .catch(() => {
            failed.push(token.toLowerCase())
          })
      : Promise.resolve(),
  ])
  return { contracts, deployer, failed }
}
