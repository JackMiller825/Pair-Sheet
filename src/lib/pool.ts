import type { ChainConfig } from "./chains"
import { decodeAbiString, sameAddress } from "./decode"
import { AppError, fetchJson, rpcCall } from "./http"
import { isStableSymbol } from "./prices"
import type { PoolContext, TokenInfo } from "./types"

const WRAPPED = new Set([
  "weth",
  "weth.e",
  "wbnb",
  "wmatic",
  "wpol",
  "wavax",
  "wftm",
  "wcro",
  "wxdai",
  "ws",
  "wbera",
  "wpulse",
  "wmetis",
  "wsonic",
])

type GeckoPool = {
  base: TokenInfo
  quote: TokenInfo
  dex: string
  dexId: string
  createdAt: string | null
  priceUsd: string | null
  reserveUsd: string | null
}

export async function resolvePool(
  chain: ChainConfig,
  address: string,
  dextoolsUrl: string,
): Promise<PoolContext> {
  const [gecko, code] = await Promise.all([
    loadGecko(chain, address),
    chain.rpcs.length
      ? rpcCall(chain.rpcs, "eth_getCode", [address, "latest"]).catch(() => "0x1")
      : Promise.resolve("0x1"),
  ])

  if (code === "0x" || code === "0x0") {
    throw new AppError(`That address is not a contract on ${chain.name}.`, 404)
  }

  let token0: TokenInfo
  let token1: TokenInfo
  try {
    const [first, second] = await Promise.all([
      readToken(chain, address, "0x0dfe1681"),
      readToken(chain, address, "0xd21220a7"),
    ])
    token0 = first
    token1 = second
  } catch (error) {
    if (gecko) {
      token0 = gecko.base
      token1 = gecko.quote
    } else {
      const message = error instanceof Error ? error.message : "token call failed"
      throw new AppError(
        `This contract does not look like a DEX pair on ${chain.name} (${message}).`,
        422,
      )
    }
  }

  if (gecko) {
    token0 = mergeToken(token0, [gecko.base, gecko.quote])
    token1 = mergeToken(token1, [gecko.base, gecko.quote])
  }

  const sides = pickSides(token0, token1, gecko)

  return {
    chainId: chain.id,
    chainName: chain.name,
    address,
    dex: gecko?.dex || "DEX pair",
    dexId: gecko?.dexId || "",
    base: sides.base,
    quote: sides.quote,
    token0: token0.address,
    token1: token1.address,
    createdAt: gecko?.createdAt ?? null,
    priceUsd: gecko?.priceUsd ?? null,
    reserveUsd: gecko?.reserveUsd ?? null,
    dextoolsUrl,
    explorerTx: `${chain.explorer}/tx`,
    explorerAddress: `${chain.explorer}/address`,
  }
}

function mergeToken(token: TokenInfo, known: TokenInfo[]): TokenInfo {
  const match = known.find((item) => sameAddress(item.address, token.address))
  if (!match) return token
  return {
    address: token.address,
    symbol: match.symbol || token.symbol,
    decimals: Number.isFinite(match.decimals) ? match.decimals : token.decimals,
  }
}

function pickSides(
  token0: TokenInfo,
  token1: TokenInfo,
  gecko: GeckoPool | null,
): { base: TokenInfo; quote: TokenInfo } {
  if (gecko) {
    const base = [token0, token1].find((token) => sameAddress(token.address, gecko.base.address))
    const quote = [token0, token1].find((token) => sameAddress(token.address, gecko.quote.address))
    if (base && quote && !sameAddress(base.address, quote.address)) return { base, quote }
  }
  const quote0 = isQuoteToken(token0.symbol)
  const quote1 = isQuoteToken(token1.symbol)
  if (quote0 && !quote1) return { base: token1, quote: token0 }
  if (quote1 && !quote0) return { base: token0, quote: token1 }
  return { base: token0, quote: token1 }
}

function isQuoteToken(symbol: string): boolean {
  return isStableSymbol(symbol) || WRAPPED.has(symbol.toLowerCase())
}

async function readToken(chain: ChainConfig, pool: string, selector: "0x0dfe1681" | "0xd21220a7"): Promise<TokenInfo> {
  if (chain.rpcs.length === 0) {
    throw new Error("no rpc")
  }
  const raw = await rpcCall(chain.rpcs, "eth_call", [{ to: pool, data: selector }, "latest"])
  if (typeof raw !== "string" || raw.length < 42) throw new Error("empty token address")
  const address = `0x${raw.slice(-40)}`.toLowerCase()
  const [symbol, decimals] = await Promise.all([
    readSymbol(chain, address),
    readDecimals(chain, address),
  ])
  return { address, symbol, decimals }
}

async function readSymbol(chain: ChainConfig, token: string): Promise<string> {
  try {
    const raw = await rpcCall(chain.rpcs, "eth_call", [{ to: token, data: "0x95d89b41" }, "latest"])
    if (typeof raw !== "string") return shortToken(token)
    const symbol = decodeAbiString(raw).trim()
    return symbol || shortToken(token)
  } catch {
    return shortToken(token)
  }
}

async function readDecimals(chain: ChainConfig, token: string): Promise<number> {
  try {
    const raw = await rpcCall(chain.rpcs, "eth_call", [{ to: token, data: "0x313ce567" }, "latest"])
    if (typeof raw !== "string") return 18
    const decimals = Number(BigInt(raw))
    return Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18
  } catch {
    return 18
  }
}

function shortToken(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

async function loadGecko(chain: ChainConfig, address: string): Promise<GeckoPool | null> {
  const url = `https://api.geckoterminal.com/api/v2/networks/${chain.gecko}/pools/${address}?include=base_token,quote_token,dex`
  try {
    const body = (await fetchJson(url, { headers: { accept: "application/json;version=20230302" } })) as {
      data?: { attributes?: Record<string, unknown>; relationships?: Record<string, { data?: { id?: string } }> }
      included?: { id: string; type: string; attributes?: Record<string, unknown> }[]
    }
    const included = body.included ?? []
    const baseId = body.data?.relationships?.base_token?.data?.id
    const quoteId = body.data?.relationships?.quote_token?.data?.id
    const dexRel = body.data?.relationships?.dex?.data?.id
    const base = included.find((item) => item.id === baseId)
    const quote = included.find((item) => item.id === quoteId)
    const dex = included.find((item) => item.type === "dex" && (!dexRel || item.id === dexRel))
    if (!base?.attributes || !quote?.attributes) return null
    const attributes = body.data?.attributes ?? {}
    return {
      base: tokenFromGecko(base.attributes),
      quote: tokenFromGecko(quote.attributes),
      dex: String(dex?.attributes?.name || dex?.id || "DEX"),
      dexId: String(dex?.id || ""),
      createdAt: typeof attributes.pool_created_at === "string" ? attributes.pool_created_at : null,
      priceUsd:
        attributes.base_token_price_usd != null ? String(attributes.base_token_price_usd) : null,
      reserveUsd: attributes.reserve_in_usd != null ? String(attributes.reserve_in_usd) : null,
    }
  } catch {
    return null
  }
}

function tokenFromGecko(attributes: Record<string, unknown>): TokenInfo {
  const decimals = Number(attributes.decimals)
  return {
    address: String(attributes.address || "").toLowerCase(),
    symbol: String(attributes.symbol || "TOKEN"),
    decimals: Number.isInteger(decimals) ? decimals : 18,
  }
}
