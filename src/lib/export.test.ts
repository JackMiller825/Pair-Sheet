import assert from "node:assert/strict"
import test from "node:test"
import { csvFilename, tradesToCsv } from "./csv"
import { SWAP_V2_TOPIC, decodeAbiString, decodeV2, decodeV3 } from "./decode"
import {
  formatTiny,
  formatTradeDate,
  priceInQuote,
  priceUsdFromTotal,
  totalUsd,
} from "./format"
import { EXAMPLE_URL, parseDextoolsUrl } from "./parse-url"
import type { PoolContext, PoolView, Trade } from "./types"

const pool: PoolContext = {
  chainId: "ether",
  chainName: "Ethereum",
  address: "0x961bde5165b921561e6e97fee8c2dfbdaf49c737",
  dex: "Uniswap V2",
  dexId: "uniswap_v2",
  base: {
    address: "0x8fe342d1165465e7595e3fe61d08ce38341b0bd0",
    symbol: "FWOG",
    decimals: 18,
  },
  quote: {
    address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    symbol: "WETH",
    decimals: 18,
  },
  token0: "0x8fe342d1165465e7595e3fe61d08ce38341b0bd0",
  token1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  createdAt: null,
  priceUsd: null,
  reserveUsd: null,
  dextoolsUrl: EXAMPLE_URL,
  explorerTx: "https://etherscan.io/tx",
  explorerAddress: "https://etherscan.io/address",
}

const SELL_DATA =
  "0x00000000000000000000000000000000000004ee2d6d415b85acef8100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003de146ad4a46f138"

test("parses DEXTools pair explorer links", () => {
  const parsed = parseDextoolsUrl(EXAMPLE_URL)
  assert.equal(parsed.chain.id, "ether")
  assert.equal(parsed.address, "0x961bde5165b921561e6e97fee8c2dfbdaf49c737")

  const localized = parseDextoolsUrl(
    "https://www.dextools.io/app/en/base/pair-explorer/0x961bde5165b921561e6e97fee8c2dfbdaf49c737?t=1",
  )
  assert.equal(localized.chain.id, "base")

  const bare = parseDextoolsUrl(
    "dextools.io/app/arbitrum/pair-explorer/0x961bde5165b921561e6e97fee8c2dfbdaf49c737/",
  )
  assert.equal(bare.chain.id, "arbitrum")
})

test("rejects links that are not a pair explorer", () => {
  assert.throws(() => parseDextoolsUrl("https://www.dextools.io/app/ether/hot-pairs"))
  assert.throws(() => parseDextoolsUrl("https://example.com/app/ether/pair-explorer/0x961bde5165b921561e6e97fee8c2dfbdaf49c737"))
})

test("decodes the FWOG sell from the screenshot", () => {
  const swap = decodeV2(SELL_DATA, pool)
  assert.ok(swap)
  assert.equal(swap.type, "SELL")
  assert.equal(swap.baseRaw, 10n ** 32n)
  assert.equal(swap.quoteRaw, 4458922816162951480n)

  const quote = priceInQuote(swap.quoteRaw, 18, swap.baseRaw, 18)
  assert.equal(quote.startsWith("0.000000000000044589"), true)

  const usd = totalUsd(swap.quoteRaw, 18, 2833.24)
  assert.ok(usd)
  assert.equal(usd.startsWith("12633."), true)
  const unit = priceUsdFromTotal(usd, "100000000000000")
  assert.ok(unit)
  assert.equal(unit.startsWith("0.000000000126"), true)
  assert.equal(SWAP_V2_TOPIC.startsWith("0xd78ad95f"), true)
})

test("decodes a v3 buy of token0", () => {
  const data = `0x${encodeInt(-2_000000000000000000n)}${encodeInt(1_500000000000000000n)}${"0".repeat(64 * 3)}`
  const swap = decodeV3(data, pool)
  assert.ok(swap)
  assert.equal(swap.type, "BUY")
  assert.equal(swap.baseRaw, 2_000000000000000000n)
  assert.equal(swap.quoteRaw, 1_500000000000000000n)
})

test("decodes a token symbol from ABI data", () => {
  const hex =
    "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000446574f4700000000000000000000000000000000000000000000000000000000"
  assert.equal(decodeAbiString(hex), "FWOG")
})

test("formats tiny prices with subscript zeros", () => {
  assert.equal(formatTiny(0.0000000001263), "0.0₉1263")
  assert.equal(formatTradeDate("2024-08-04T15:54:23.000Z"), "Aug 4 24 15:54:23")
})

test("writes an excel-friendly csv", () => {
  const view: PoolView = {
    chainId: "ether",
    chainName: "Ethereum",
    address: pool.address,
    dex: "Uniswap V2",
    baseSymbol: "FWOG",
    quoteSymbol: "WETH",
    baseAddress: pool.base.address,
    quoteAddress: pool.quote.address,
    createdAt: null,
    priceUsd: null,
    reserveUsd: null,
    dextoolsUrl: EXAMPLE_URL,
    explorerTx: pool.explorerTx,
    explorerAddress: pool.explorerAddress,
  }
  const trade: Trade = {
    id: "tx-1",
    timestamp: "2024-08-04T15:54:23.000Z",
    blockNumber: 20456217,
    logIndex: 206,
    type: "SELL",
    priceUsd: "0.00000000012633",
    totalUsd: "12633.15",
    priceQuote: "0.000000000000044589",
    baseAmount: "100000000000000",
    quoteAmount: "4.45892281616295148",
    maker: "0x591f85c11cafea17f7cc926f13e2ed7c794f2522",
    txHash: "0xabc,def",
  }
  const csv = tradesToCsv(view, [trade])
  assert.equal(csv.startsWith("\uFEFF"), true)
  assert.match(csv, /date_utc,type,price_usd,total_usd/)
  assert.match(csv, /"0xabc,def"/)
  assert.equal(csvFilename(view), "fwog-weth-ether-swaps.csv")
})

function encodeInt(value: bigint): string {
  const mod = (1n << 256n) + (value < 0n ? value : 0n)
  const encoded = value < 0n ? mod : value
  return encoded.toString(16).padStart(64, "0")
}
