import type { PoolContext, RawLog, Side } from "./types"

export const SWAP_V2_TOPIC =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"
export const SWAP_V3_TOPIC =
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"

export type DecodedSwap = {
  type: Side
  baseRaw: bigint
  quoteRaw: bigint
}

export function topicOrder(dexId: string, dexName: string): string[] {
  const label = `${dexId} ${dexName}`.toLowerCase()
  const concentrated = /v3|algebra|slipstream|concentrated/.test(label)
  return concentrated
    ? [SWAP_V3_TOPIC, SWAP_V2_TOPIC]
    : [SWAP_V2_TOPIC, SWAP_V3_TOPIC]
}

export function decodeWord(data: string, index: number): bigint {
  const clean = data.startsWith("0x") ? data.slice(2) : data
  const word = clean.slice(index * 64, (index + 1) * 64)
  if (word.length !== 64) {
    throw new Error("Swap log data is shorter than expected")
  }
  return BigInt(`0x${word}`)
}

export function decodeInt256(data: string, index: number): bigint {
  const value = decodeWord(data, index)
  const limit = 1n << 255n
  return value >= limit ? value - (1n << 256n) : value
}

export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

export function decodeSwap(log: RawLog, pool: PoolContext): DecodedSwap | null {
  const topic = (log.topics[0] || "").toLowerCase()
  if (topic === SWAP_V2_TOPIC) return decodeV2(log.data, pool)
  if (topic === SWAP_V3_TOPIC) return decodeV3(log.data, pool)
  return null
}

function flows(data: string, pool: PoolContext, v3: boolean) {
  const baseIs0 = sameAddress(pool.token0, pool.base.address)
  if (!v3) {
    const amount0In = decodeWord(data, 0)
    const amount1In = decodeWord(data, 1)
    const amount0Out = decodeWord(data, 2)
    const amount1Out = decodeWord(data, 3)
    const baseIn = baseIs0 ? amount0In : amount1In
    const baseOut = baseIs0 ? amount0Out : amount1Out
    const quoteIn = baseIs0 ? amount1In : amount0In
    const quoteOut = baseIs0 ? amount1Out : amount0Out
    return { baseIn, baseOut, quoteIn, quoteOut }
  }

  const amount0 = decodeInt256(data, 0)
  const amount1 = decodeInt256(data, 1)
  const baseDelta = baseIs0 ? amount0 : amount1
  const quoteDelta = baseIs0 ? amount1 : amount0
  return {
    baseIn: baseDelta > 0n ? baseDelta : 0n,
    baseOut: baseDelta < 0n ? -baseDelta : 0n,
    quoteIn: quoteDelta > 0n ? quoteDelta : 0n,
    quoteOut: quoteDelta < 0n ? -quoteDelta : 0n,
  }
}

function classify(flow: {
  baseIn: bigint
  baseOut: bigint
  quoteIn: bigint
  quoteOut: bigint
}): DecodedSwap | null {
  if (flow.baseIn > 0n && flow.quoteOut > 0n && flow.baseIn >= flow.baseOut) {
    return { type: "SELL", baseRaw: flow.baseIn, quoteRaw: flow.quoteOut }
  }
  if (flow.quoteIn > 0n && flow.baseOut > 0n) {
    return { type: "BUY", baseRaw: flow.baseOut, quoteRaw: flow.quoteIn }
  }
  return null
}

export function decodeV2(data: string, pool: PoolContext): DecodedSwap | null {
  return classify(flows(data, pool, false))
}

export function decodeV3(data: string, pool: PoolContext): DecodedSwap | null {
  return classify(flows(data, pool, true))
}

export function decodeAbiString(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  if (!clean || /^0+$/.test(clean)) return ""
  if (clean.length === 64) {
    return Buffer.from(clean, "hex").toString("utf8").replace(/\0+$/g, "")
  }
  const offsetBytes = Number(BigInt(`0x${clean.slice(0, 64)}`))
  const start = offsetBytes * 2
  const length = Number(BigInt(`0x${clean.slice(start, start + 64)}`))
  const data = clean.slice(start + 64, start + 64 + length * 2)
  return Buffer.from(data, "hex").toString("utf8").replace(/\0+$/g, "")
}
