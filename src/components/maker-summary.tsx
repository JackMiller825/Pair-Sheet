"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Copy } from "lucide-react"
import { compareDecimal, formatCompact, formatPanelUsd, formatQuoteAmount } from "@/lib/format"
import { balanceShare, holdingValue, type MakerSummary } from "@/lib/maker"
import { shortAddress } from "@/lib/format"

type Props = {
  maker: string
  count: number
  summary: MakerSummary | null
  baseSymbol: string
  quoteSymbol: string
  priceUsd: string | null
  priceQuote: string | null
  partial: boolean
  onFilter: () => void
}

export function MakerCountButton({
  maker,
  count,
  summary,
  baseSymbol,
  quoteSymbol,
  priceUsd,
  priceQuote,
  partial,
  onFilter,
}: Props) {
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  function clearHide() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  function openPanel() {
    clearHide()
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) setAnchor(rect)
    setOpen(true)
  }

  function scheduleClose() {
    clearHide()
    hideTimer.current = setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => () => clearHide(), [])

  useEffect(() => {
    if (!open) return
    function sync() {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) setAnchor(rect)
    }
    window.addEventListener("scroll", sync, true)
    window.addEventListener("resize", sync)
    return () => {
      window.removeEventListener("scroll", sync, true)
      window.removeEventListener("resize", sync)
    }
  }, [open])

  const label = `${count.toLocaleString("en-US")} transaction${count === 1 ? "" : "s"} by this wallet in this pool`

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="ml-2 rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground hover:bg-accent"
        aria-label={`${label}. Hover for buy and sell totals. Click to show only this wallet.`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onMouseEnter={openPanel}
        onMouseLeave={scheduleClose}
        onFocus={openPanel}
        onBlur={(event) => {
          const next = event.relatedTarget
          if (next instanceof Node && document.getElementById(panelId)?.contains(next)) return
          scheduleClose()
        }}
        onClick={onFilter}
      >
        {count.toLocaleString("en-US")}
      </button>
      {open && anchor && summary
        ? createPortal(
            <MakerPanel
              id={panelId}
              anchor={anchor}
              maker={maker}
              summary={summary}
              baseSymbol={baseSymbol}
              quoteSymbol={quoteSymbol}
              priceUsd={priceUsd}
              priceQuote={priceQuote}
              partial={partial}
              onEnter={openPanel}
              onLeave={scheduleClose}
            />,
            document.body,
          )
        : null}
    </>
  )
}

function MakerPanel({
  id,
  anchor,
  maker,
  summary,
  baseSymbol,
  quoteSymbol,
  priceUsd,
  priceQuote,
  partial,
  onEnter,
  onLeave,
}: {
  id: string
  anchor: DOMRect
  maker: string
  summary: MakerSummary
  baseSymbol: string
  quoteSymbol: string
  priceUsd: string | null
  priceQuote: string | null
  partial: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const unrealizedUsd = holdingValue(summary.balanceBase, priceUsd)
  const unrealizedQuote = holdingValue(summary.balanceBase, priceQuote)
  const share = balanceShare(summary.balanceBase, summary.boughtBase)
  const liquidity = summary.adds + summary.removes
  const holding = compareDecimal(summary.balanceBase, "0")
  const balanceUsd =
    holding > 0 ? (unrealizedUsd ? formatPanelUsd(unrealizedUsd) : null) : holding === 0 ? "$0" : null

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const margin = 8
    let left = anchor.left + anchor.width / 2 - rect.width / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin))
    const above = anchor.top - rect.height
    const below = anchor.bottom
    let top = above
    if (above < margin) {
      top = below + rect.height <= window.innerHeight - margin ? below : Math.max(margin, window.innerHeight - rect.height - margin)
    }
    setPos({ top, left })
  }, [anchor, summary, baseSymbol, quoteSymbol, priceUsd, priceQuote, partial])

  async function copyMaker() {
    try {
      await navigator.clipboard.writeText(maker)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const bar = share <= 0 ? 0 : Math.max(share * 100, 0.8)

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label={`${baseSymbol} totals for ${shortAddress(maker)}`}
      className="fixed z-[80] px-1 py-3"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="w-[min(32rem,calc(100vw-1rem))] rounded-xl border border-white/10 bg-[#0c1726] p-4 text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-400/15 text-xs font-semibold text-amber-300">
            {baseSymbol.slice(0, 1) || "?"}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold">{baseSymbol}</span>
            <span className="text-white/70"> tokens in </span>
            <span className="font-mono text-white/90">{shortAddress(maker)}</span>
          </p>
          <button
            type="button"
            className="grid size-7 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
            aria-label={copied ? "Address copied" : "Copy maker address"}
            onClick={() => void copyMaker()}
          >
            {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
          </button>
        </div>

        <p className="mt-3 text-lg font-semibold tracking-tight">
          <span className="font-mono">{formatCompact(summary.balanceBase)}</span>{" "}
          <span className="text-sm font-medium text-white/80">{baseSymbol}</span>
          {balanceUsd ? <span className="ml-1.5 text-sm font-normal text-white/60">({balanceUsd})</span> : null}
        </p>

        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="text-[10px] tracking-wide text-slate-400 uppercase">
              <th className="py-1 pr-3 text-left font-medium" />
              <th className="px-2 py-1 text-right font-medium">USD</th>
              <th className="px-2 py-1 text-right font-medium">{quoteSymbol}</th>
              <th className="px-2 py-1 text-right font-medium">{baseSymbol}</th>
              <th className="py-1 pl-2 text-right font-medium">TXNS</th>
            </tr>
          </thead>
          <tbody>
            <SummaryRow
              label="Bought"
              tone="text-emerald-400"
              usd={formatPanelUsd(summary.boughtUsd)}
              quote={formatQuoteAmount(summary.boughtQuote)}
              base={formatCompact(summary.boughtBase)}
              txns={summary.buys.toLocaleString("en-US")}
            />
            <SummaryRow
              label="Sold"
              tone="text-rose-400"
              usd={formatPanelUsd(summary.soldUsd)}
              quote={formatQuoteAmount(summary.soldQuote)}
              base={formatCompact(summary.soldBase)}
              txns={summary.sells.toLocaleString("en-US")}
            />
            <SummaryRow
              label="PnL"
              tone={pnlTone(summary.pnlUsd ?? summary.pnlQuote)}
              usd={formatPanelUsd(summary.pnlUsd)}
              quote={formatQuoteAmount(summary.pnlQuote)}
              usdTone={pnlTone(summary.pnlUsd)}
              quoteTone={pnlTone(summary.pnlQuote)}
              base="—"
              txns="—"
            />
            <SummaryRow
              label="Unrealized"
              tone="text-slate-300"
              usd={holding > 0 ? formatPanelUsd(unrealizedUsd) : "—"}
              quote={holding > 0 ? (unrealizedQuote ? formatQuoteAmount(unrealizedQuote) : "—") : "—"}
              base={holding > 0 ? formatCompact(summary.balanceBase) : "—"}
              txns="—"
            />
          </tbody>
        </table>

        <div className="mt-3">
          <p className="text-right font-mono text-[11px] text-slate-300">
            {formatCompact(summary.balanceBase)} of {formatCompact(summary.boughtBase)}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#1b2c44]">
            <div className="h-full rounded-full bg-cyan-300" style={{ width: `${bar}%` }} />
          </div>
        </div>

        {liquidity > 0 || partial ? (
          <p className="mt-3 text-[11px] leading-4 text-slate-400">
            {liquidity > 0
              ? `${liquidity.toLocaleString("en-US")} liquidity ${liquidity === 1 ? "event is" : "events are"} separate from these buy and sell totals.`
              : null}
            {liquidity > 0 && partial ? " " : null}
            {partial ? "Totals use the transactions loaded for this pool." : null}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  tone,
  usd,
  quote,
  base,
  txns,
  usdTone,
  quoteTone,
}: {
  label: string
  tone: string
  usd: string
  quote: string
  base: string
  txns: string
  usdTone?: string
  quoteTone?: string
}) {
  return (
    <tr>
      <th scope="row" className={`py-1 pr-3 text-left text-[11px] font-semibold tracking-wide uppercase ${tone}`}>
        {label}
      </th>
      <td className={`px-2 py-1 text-right font-mono ${usdTone ?? "text-white"}`}>{usd}</td>
      <td className={`px-2 py-1 text-right font-mono ${quoteTone ?? "text-white"}`}>{quote}</td>
      <td className="px-2 py-1 text-right font-mono text-white">{base}</td>
      <td className="py-1 pl-2 text-right font-mono text-white">{txns}</td>
    </tr>
  )
}

function pnlTone(amount: string | null): string {
  if (!amount) return "text-slate-300"
  const cmp = compareDecimal(amount, "0")
  if (cmp > 0) return "text-emerald-400"
  if (cmp < 0) return "text-rose-400"
  return "text-slate-300"
}
