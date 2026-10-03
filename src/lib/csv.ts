import type { PoolView, Trade } from "./types"

const HEADERS = [
  "date_utc",
  "type",
  "price_usd",
  "total_usd",
  "price_in_quote",
  "base_symbol",
  "base_amount",
  "quote_symbol",
  "quote_amount",
  "pool_base_after",
  "pool_quote_after",
  "maker",
  "funded_by",
  "funded_by_address",
  "tx_hash",
  "block_number",
  "log_index",
  "chain",
  "pool_address",
]

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function tradesToCsv(pool: PoolView, trades: Trade[]): string {
  const lines = [HEADERS.join(",")]
  for (const trade of trades) {
    lines.push(
      [
        trade.timestamp,
        trade.type,
        trade.priceUsd,
        trade.totalUsd,
        trade.priceQuote,
        pool.baseSymbol,
        trade.baseAmount,
        pool.quoteSymbol,
        trade.quoteAmount,
        trade.baseReserve,
        trade.quoteReserve,
        trade.maker,
        trade.fundedBy,
        trade.fundedByAddress,
        trade.txHash,
        trade.blockNumber,
        trade.logIndex,
        pool.chainId,
        pool.address,
      ]
        .map(escapeCell)
        .join(","),
    )
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`
}

export function csvFilename(pool: Pick<PoolView, "baseSymbol" | "quoteSymbol" | "chainId">): string {
  const slug = `${pool.baseSymbol}-${pool.quoteSymbol}-${pool.chainId}-swaps`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
  return `${slug}.csv`
}
