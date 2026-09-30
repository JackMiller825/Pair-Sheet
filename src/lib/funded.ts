import type { ChainConfig } from "./chains"
import { sameAddress } from "./decode"
import { shortAddress } from "./format"
import { fetchJson, mapPool, sleep } from "./http"

const KNOWN_LABELS: Record<string, string> = {
  "0xd152f549545093347a162dce210e7293f1452150": "Disperse.app",
}

export type FundingRow = {
  from: string
  to: string
  value: string
  blockNumber: number
  timestamp: number
  fromName?: string | null
  fromEns?: string | null
  fromTags?: string[]
}

export type Funder = {
  address: string
  label: string
}

export function earliestIncoming(maker: string, rows: FundingRow[]): FundingRow | null {
  const incoming = rows.filter((row) => {
    if (!row.to || !sameAddress(row.to, maker)) return false
    try {
      return BigInt(row.value || "0") > 0n
    } catch {
      return false
    }
  })
  incoming.sort((left, right) => left.blockNumber - right.blockNumber || left.timestamp - right.timestamp)
  return incoming[0] ?? null
}

export function funderLabel(
  address: string,
  profile: { name?: string | null; ens?: string | null; tags?: string[] },
): string {
  const known = KNOWN_LABELS[address.toLowerCase()]
  if (known) return known
  const tag = profile.tags?.find((item) => item.trim())
  if (tag) return tag
  if (profile.name?.trim()) return profile.name.trim()
  if (profile.ens?.trim()) return profile.ens.trim()
  return shortAddress(address)
}

export async function resolveFunders(chain: ChainConfig, makers: string[]): Promise<Map<string, Funder>> {
  const unique = [...new Set(makers.map((maker) => maker.toLowerCase()).filter(Boolean))]
  const funders = new Map<string, Funder>()
  const labels = new Map<string, string>()
  await mapPool(unique, 8, async (maker) => {
    try {
      const rows = await fundingRows(chain, maker)
      const first = earliestIncoming(maker, rows)
      if (!first) return
      const address = first.from.toLowerCase()
      let label = labels.get(address)
      if (!label) {
        label = funderLabel(address, {
          name: first.fromName,
          ens: first.fromEns,
          tags: first.fromTags,
        })
        labels.set(address, label)
      }
      funders.set(maker, { address, label })
    } catch {
      return
    }
  })
  return funders
}

async function fundingRows(chain: ChainConfig, maker: string): Promise<FundingRow[]> {
  if (chain.blockscout) {
    const [internalRows, normalRows] = await Promise.all([
      blockscoutList(chain.blockscout, maker, "internal-transactions"),
      blockscoutList(chain.blockscout, maker, "transactions"),
    ])
    return [...internalRows, ...normalRows]
  }
  return routescanRows(chain, maker)
}

async function blockscoutList(
  host: string,
  maker: string,
  kind: "internal-transactions" | "transactions",
): Promise<FundingRow[]> {
  const rows: FundingRow[] = []
  const oldestFirst = kind === "transactions"
  let params = oldestFirst ? "?sort=block_number&order=asc" : ""
  for (let page = 0; page < 4; page += 1) {
    const url = `${host}/api/v2/addresses/${maker}/${kind}${params}`
    const body = (await fetchFunding(url)) as {
      items?: unknown[]
      next_page_params?: Record<string, string | number | null> | null
    }
    for (const item of body.items ?? []) {
      const parsed = parseBlockscout(item)
      if (parsed) rows.push(parsed)
    }
    if (oldestFirst && earliestIncoming(maker, rows)) break
    const next = body.next_page_params
    if (!next) break
    params = `?${new URLSearchParams(
      Object.entries(next)
        .filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined)
        .map(([key, value]) => [key, String(value)]),
    )}`
  }
  return rows
}

async function routescanRows(chain: ChainConfig, maker: string): Promise<FundingRow[]> {
  if (!chain.routescan) return []
  const base = `https://api.routescan.io/v2/network/mainnet/evm/${chain.chainId}/etherscan/api`
  const rows: FundingRow[] = []
  for (const action of ["txlistinternal", "txlist"]) {
    const params = new URLSearchParams({
      module: "account",
      action,
      address: maker,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: "20",
      sort: "asc",
    })
    const body = (await fetchFunding(`${base}?${params}`)) as { result?: unknown }
    if (!Array.isArray(body.result)) continue
    for (const item of body.result) {
      const parsed = parseExplorer(item)
      if (parsed) rows.push(parsed)
    }
  }
  return rows
}

async function fetchFunding(url: string): Promise<unknown> {
  let last: Error | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchJson(url, undefined, 20000)
    } catch (error) {
      last = error instanceof Error ? error : new Error("funding lookup failed")
      if (!/429|502|503|504|upstream/i.test(last.message)) break
      await sleep(400 * (attempt + 1))
    }
  }
  throw last ?? new Error("funding lookup failed")
}

function parseBlockscout(item: unknown): FundingRow | null {
  if (!item || typeof item !== "object") return null
  const row = item as Record<string, unknown>
  const from = party(row.from)
  const to = party(row.to)
  if (!from?.hash || !to?.hash) return null
  const timestamp = typeof row.timestamp === "string" ? Date.parse(row.timestamp) : 0
  return {
    from: from.hash,
    to: to.hash,
    value: typeof row.value === "string" || typeof row.value === "number" ? String(row.value) : "0",
    blockNumber: Number(row.block_number) || 0,
    timestamp: Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0,
    fromName: from.name,
    fromEns: from.ens,
    fromTags: from.tags,
  }
}

function party(value: unknown): { hash: string; name: string | null; ens: string | null; tags: string[] } | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.hash !== "string") return null
  const tags = Array.isArray(row.public_tags)
    ? row.public_tags
        .map((tag) => {
          if (!tag || typeof tag !== "object") return ""
          const record = tag as { display_name?: string; label?: string }
          return record.display_name || record.label || ""
        })
        .filter(Boolean)
    : []
  return {
    hash: row.hash,
    name: typeof row.name === "string" ? row.name : null,
    ens: typeof row.ens_domain_name === "string" ? row.ens_domain_name : null,
    tags,
  }
}

function parseExplorer(item: unknown): FundingRow | null {
  if (!item || typeof item !== "object") return null
  const row = item as Record<string, unknown>
  const from = typeof row.from === "string" ? row.from : ""
  const to = typeof row.to === "string" ? row.to : ""
  if (!from || !to) return null
  return {
    from,
    to,
    value: typeof row.value === "string" || typeof row.value === "number" ? String(row.value) : "0",
    blockNumber: numberField(row.blockNumber),
    timestamp: numberField(row.timeStamp),
  }
}

function numberField(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value !== "string" || !value) return 0
  return Number.parseInt(value, value.startsWith("0x") ? 16 : 10) || 0
}
