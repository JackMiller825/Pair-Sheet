"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Download, ExternalLink, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supportedChainNames } from "@/lib/chains"
import { csvFilename, tradesToCsv } from "@/lib/csv"
import { compareDecimal, formatGroupedAmount, formatTiny, formatTradeDate, formatUsd, shortAddress } from "@/lib/format"
import { EXAMPLE_URL } from "@/lib/parse-url"
import type { PoolView, SwapsResponse, Trade } from "@/lib/types"

const MAX_TRADES = 20000

type Phase = "idle" | "loading" | "done" | "error"
type SideFilter = "ALL" | "BUY" | "SELL"
type SortKey =
  | "timestamp"
  | "type"
  | "priceUsd"
  | "totalUsd"
  | "priceQuote"
  | "baseAmount"
  | "quoteAmount"
  | "maker"
  | "fundedBy"

const CHAINS = supportedChainNames().join(", ")

export function Exporter() {
  const [url, setUrl] = useState(EXAMPLE_URL)
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [pool, setPool] = useState<PoolView | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [progress, setProgress] = useState("")
  const [capped, setCapped] = useState(false)
  const [filter, setFilter] = useState<SideFilter>("ALL")
  const [query, setQuery] = useState("")
  const [funder, setFunder] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("timestamp")
  const [sortDesc, setSortDesc] = useState(true)
  const [copied, setCopied] = useState(false)

  async function load(target = url) {
    const trimmed = target.trim()
    setPhase("loading")
    setError(null)
    setWarning(null)
    setCapped(false)
    setPool(null)
    setTrades([])
    setFunder("")
    setProgress("Reading swaps and who funded each wallet…")

    try {
      let cursor: string | null = null
      const loaded: Trade[] = []
      const seen = new Set<string>()
      do {
        const response = await fetch("/api/swaps", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: trimmed, cursor }),
        })
        const body = (await response.json()) as SwapsResponse & { error?: string }
        if (!response.ok) {
          throw new Error(body.error || "Could not load swaps.")
        }
        setPool(body.pool)
        if (body.warning) setWarning(body.warning)
        for (const trade of body.trades) {
          if (seen.has(trade.id)) continue
          seen.add(trade.id)
          loaded.push(trade)
        }
        setTrades([...loaded])
        setProgress(
          body.nextCursor
            ? `Loaded ${loaded.length.toLocaleString("en-US")} swaps. Still reading the chain…`
            : `Loaded ${loaded.length.toLocaleString("en-US")} swaps.`,
        )
        cursor = body.nextCursor
        if (cursor && loaded.length >= MAX_TRADES) {
          setCapped(true)
          cursor = null
        }
      } while (cursor)
      setPhase("done")
    } catch (loadError) {
      setPhase("error")
      setError(loadError instanceof Error ? loadError.message : "Could not load swaps.")
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = trades.filter((trade) => {
      if (filter !== "ALL" && trade.type !== filter) return false
      if (funder === "__none__" && trade.fundedByAddress) return false
      if (funder && funder !== "__none__" && trade.fundedByAddress !== funder) return false
      if (!needle) return true
      return (
        trade.maker.includes(needle) ||
        trade.txHash.includes(needle) ||
        (trade.fundedBy ?? "").toLowerCase().includes(needle) ||
        (trade.fundedByAddress ?? "").includes(needle)
      )
    })
    const sorted = [...rows].sort((a, b) => compareTrades(a, b, sortKey) * (sortDesc ? -1 : 1))
    return sorted
  }, [trades, filter, funder, query, sortKey, sortDesc])

  const funders = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const trade of trades) {
      const key = trade.fundedByAddress || "__none__"
      const current = counts.get(key) ?? { label: trade.fundedBy || "Unknown", count: 0 }
      current.count += 1
      counts.set(key, current)
    }
    return [...counts.entries()].sort((left, right) => right[1].count - left[1].count || left[1].label.localeCompare(right[1].label))
  }, [trades])

  const stats = useMemo(() => summarize(trades), [trades])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc((value) => !value)
      return
    }
    setSortKey(key)
    setSortDesc(key === "maker" || key === "type" || key === "fundedBy" ? false : true)
  }

  function download() {
    if (!pool || filtered.length === 0) return
    const csv = tradesToCsv(pool, filtered)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = csvFilename(pool)
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function copyAddress() {
    if (!pool) return
    await navigator.clipboard.writeText(pool.address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:py-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_0_6px_oklch(0.82_0.12_190/0.12)]">
            <LedgerMark />
          </span>
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">On-chain tape</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Pair Sheet</h1>
          </div>
        </div>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Paste a DEXTools pair link. Pair Sheet reads every buy and sell from the pool contract and saves the tape as CSV.
        </p>
      </header>

      <form
        className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void load()
        }}
      >
        <label htmlFor="pair-url" className="mb-2 block text-sm font-medium">
          DEXTools pair URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="pair-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={EXAMPLE_URL}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="h-11 flex-1 font-mono text-sm"
            aria-invalid={phase === "error"}
          />
          <Button type="submit" size="lg" className="h-11 px-4" disabled={phase === "loading"}>
            {phase === "loading" ? <Loader2 className="animate-spin" /> : null}
            {phase === "loading" ? "Reading chain" : "Load swaps"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="rounded-full bg-muted px-3 py-1 text-foreground hover:bg-accent disabled:opacity-50"
            disabled={phase === "loading"}
            onClick={() => {
              setUrl(EXAMPLE_URL)
              void load(EXAMPLE_URL)
            }}
          >
            Try the FWOG / WETH example
          </button>
          <span>Ethereum, Base, Arbitrum, Polygon, Optimism, and other EVM pools.</span>
        </div>
      </form>

      {phase === "loading" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {progress}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      {pool ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {pool.baseSymbol} / {pool.quoteSymbol}
                </h2>
                <Badge>{pool.chainName}</Badge>
                <Badge variant="outline">{pool.dex}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <button type="button" className="font-mono text-foreground hover:text-primary" onClick={() => void copyAddress()}>
                  {copied ? "Copied" : pool.address}
                </button>
                <a className="inline-flex items-center gap-1 hover:text-foreground" href={pool.dextoolsUrl} target="_blank" rel="noreferrer">
                  DEXTools <ExternalLink className="size-3.5" />
                </a>
                <a
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  href={`${pool.explorerAddress}/${pool.address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Explorer <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
            <Button type="button" size="lg" className="h-11" onClick={download} disabled={filtered.length === 0}>
              <Download />
              Download CSV
              {filtered.length > 0 ? ` · ${filtered.length.toLocaleString("en-US")}` : ""}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Swaps" value={stats.count.toLocaleString("en-US")} />
            <Stat label="Buys" value={stats.buys.toLocaleString("en-US")} tone="buy" />
            <Stat label="Sells" value={stats.sells.toLocaleString("en-US")} tone="sell" />
            <Stat label="Quote volume" value={stats.volume} />
          </div>

          {warning ? <p className="text-sm text-muted-foreground">{warning}</p> : null}
          {capped ? (
            <p className="text-sm text-muted-foreground">
              Stopped at {MAX_TRADES.toLocaleString("en-US")} swaps. This pool has more history than one export pulls.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["ALL", "BUY", "SELL"] as SideFilter[]).map((side) => (
                <button
                  key={side}
                  type="button"
                  aria-pressed={filter === side}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === side ? "bg-background text-foreground" : "text-muted-foreground"}`}
                  onClick={() => setFilter(side)}
                >
                  {side === "ALL" ? "All" : side === "BUY" ? "Buys" : "Sells"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Funded by
              <select
                aria-label="Filter by funded by"
                value={funder}
                onChange={(event) => setFunder(event.target.value)}
                className="h-9 max-w-56 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              >
                <option value="">All</option>
                {funders.map(([address, info]) => (
                  <option key={address} value={address}>
                    {info.label} ({info.count})
                  </option>
                ))}
              </select>
            </label>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by maker, funder, or tx"
              className="h-9 sm:max-w-xs"
              spellCheck={false}
            />
          </div>

          <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <caption className="sr-only">
                  Swaps for {pool.baseSymbol} / {pool.quoteSymbol}
                </caption>
                <thead className="bg-muted/70 text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <SortHeader label="Date (UTC)" column="timestamp" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} />
                    <SortHeader label="Type" column="type" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} />
                    <SortHeader label="Price (USD)" column="priceUsd" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} align="right" />
                    <SortHeader label="Total" column="totalUsd" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} align="right" />
                    <SortHeader label={`Price (${pool.quoteSymbol})`} column="priceQuote" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} align="right" />
                    <SortHeader label={pool.baseSymbol} column="baseAmount" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} align="right" />
                    <SortHeader label={pool.quoteSymbol} column="quoteAmount" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} align="right" />
                    <SortHeader label="Maker" column="maker" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} />
                    <SortHeader label="Funded by" column="fundedBy" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                        {phase === "loading"
                          ? "Reading swap logs…"
                          : trades.length === 0
                            ? "No Uniswap-style swaps were found on this pool."
                            : "Nothing matches this filter."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((trade) => (
                      <tr key={trade.id} className="border-t border-border/80 hover:bg-muted/40">
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatTradeDate(trade.timestamp)}</td>
                        <td className="px-3 py-2">
                          <span className={trade.type === "BUY" ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{trade.priceUsd ? `$${formatTiny(Number(trade.priceUsd))}` : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatUsd(trade.totalUsd)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{trade.priceQuote ? formatTiny(Number(trade.priceQuote)) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatGroupedAmount(trade.baseAmount)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatGroupedAmount(trade.quoteAmount)}</td>
                        <td className="px-3 py-2">
                          {trade.maker ? (
                            <a
                              className="font-mono text-xs hover:text-primary"
                              href={`${pool.explorerAddress}/${trade.maker}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {shortAddress(trade.maker)}
                            </a>
                          ) : (
                            "—"
                          )}
                          <a
                            className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                            href={`${pool.explorerTx}/${trade.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            tx
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          {trade.fundedBy && trade.fundedByAddress ? (
                            <a
                              className="text-xs font-medium text-rose-300 hover:text-rose-200"
                              href={`${pool.explorerAddress}/${trade.fundedByAddress}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {trade.fundedBy}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Amounts come from on-chain Swap events. USD totals multiply the quote token by its historical price from DefiLlama.
            The CSV includes the rows currently shown
            {filter !== "ALL" || funder || query.trim() ? " after filters" : ""}. Dates in the file are UTC. Funded by is the address that first sent native currency to the maker. Each maker and transaction links to the explorer. Supported chains: {CHAINS}.
          </p>
        </section>
      ) : phase === "idle" || phase === "error" ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Step n="1" title="Paste the pair" body="Use the pair-explorer URL from DEXTools, including the chain and pool address." />
          <Step n="2" title="Read the tape" body="Buys and sells are decoded from the pool’s Swap logs, with the wallet that sent each transaction." />
          <Step n="3" title="Save the CSV" body="Date, side, USD price, total, both token amounts, maker, who funded that wallet, and transaction hash." />
        </section>
      ) : null}
    </div>
  )
}

function summarize(trades: Trade[]) {
  let buys = 0
  let sells = 0
  let volume = 0
  for (const trade of trades) {
    if (trade.type === "BUY") buys += 1
    else sells += 1
    const total = Number(trade.totalUsd)
    if (Number.isFinite(total)) volume += total
  }
  return {
    count: trades.length,
    buys,
    sells,
    volume: volume > 0 ? formatUsd(volume.toFixed(2)) : "—",
  }
}

function compareTrades(a: Trade, b: Trade, key: SortKey): number {
  if (key === "timestamp") return a.timestamp.localeCompare(b.timestamp) || a.logIndex - b.logIndex
  if (key === "type" || key === "maker") return a[key].localeCompare(b[key])
  if (key === "fundedBy") return (a.fundedBy || "").localeCompare(b.fundedBy || "")
  const left = a[key] || "0"
  const right = b[key] || "0"
  return compareDecimal(left, right)
}

function SortHeader({
  label,
  column,
  sortKey,
  desc,
  onSort,
  align = "left",
}: {
  label: string
  column: SortKey
  sortKey: SortKey
  desc: boolean
  onSort: (column: SortKey) => void
  align?: "left" | "right"
}) {
  const active = sortKey === column
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button type="button" className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`} onClick={() => onSort(column)}>
        {label}
        {active ? desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : null}
      </button>
    </th>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "buy" | "sell" }) {
  const color = tone === "buy" ? "text-emerald-400" : tone === "sell" ? "text-rose-400" : "text-foreground"
  return (
    <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1 font-mono text-xl ${color}`}>{value}</p>
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="font-mono text-xs text-primary">0{n}</p>
      <h2 className="mt-2 font-medium">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  )
}

function LedgerMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M6 4.5h9.5A2.5 2.5 0 0 1 18 7v12.2a.8.8 0 0 1-1.2.7L14 18.2l-2.8 1.7a.8.8 0 0 1-.8 0L7.6 18.2 4.8 19.9A.8.8 0 0 1 3.6 19.2V7A2.5 2.5 0 0 1 6 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M7.5 9h6M7.5 12.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
