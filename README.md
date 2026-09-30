# Pair Sheet

Paste a [DEXTools](https://www.dextools.io) pair-explorer link and download every buy and sell on that pool as CSV.

Example:

`https://www.dextools.io/app/ether/pair-explorer/0x961bde5165b921561e6e97fee8c2dfbdaf49c737`

The app reads `Swap` events from the pool contract (Uniswap v2 and v3 style), resolves the wallet that sent each transaction, and prices the quote token with historical data from DefiLlama. Amounts in the file are the on-chain values. USD figures follow the quote token’s price at the time of the swap, so they can differ slightly from the number shown on DEXTools.

## CSV columns

`date_utc`, `type` (`BUY` or `SELL`), `price_usd`, `total_usd`, `price_in_quote`, `base_symbol`, `base_amount`, `quote_symbol`, `quote_amount`, `maker`, `funded_by`, `funded_by_address`, `tx_hash`, `block_number`, `log_index`, `chain`, `pool_address`

`funded_by` is the public name of the address that first sent native currency to the maker, the same “Funded by” field Etherscan shows. A known label such as Disperse.app is used when one exists. Otherwise the column shows the contract name, ENS name, or a shortened address. The table has the same Funded by column, and the dropdown above it filters the tape and the CSV to one funder.

Swaps load first, then the page looks up funders in small batches through `/api/funders`, so a slow or rate-limited explorer never fails the whole load. Wallets the explorer could not answer are retried a few times, and Download CSV unlocks when the lookup finishes.

Dates are UTC. `BUY` means the pool sent the base token out (the trader bought it). The side is taken from the base token GeckoTerminal shows for the pool, usually the non-wrapped asset.

## Run locally

```bash
npm install
npm run dev
```

The dev server in this environment is started on port **41731**:

```bash
npm run dev -- --port 41731
```

Open [http://127.0.0.1:41731](http://127.0.0.1:41731).

```bash
npm test
npm run lint
```

## Supported chains

Full history is available where a public log index exists:

Ethereum, Polygon, Base, Arbitrum, Optimism, Avalanche, Blast, zkSync, Celo, Unichain, World Chain, Metis, and Chiliz.

BNB Chain, Linea, Scroll, Gnosis, and Mantle are recognized in DEXTools URLs, but this app does not have a public full-history index for them yet. Solana and other non-EVM DEXTools chains are not exported.

Exports stop at 20,000 swaps and say so when a pool is larger.

## How a link is read

`https://www.dextools.io/app/{chain}/pair-explorer/{pool}`

A locale segment is fine: `/app/en/ether/pair-explorer/0x…`.
