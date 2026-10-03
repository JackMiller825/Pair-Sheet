import { getChain } from "@/lib/chains"
import { AppError } from "@/lib/http"
import { lookUpWallets } from "@/lib/wallets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_ADDRESSES = 15
const ADDRESS = /^0x[a-fA-F0-9]{40}$/

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { chain?: unknown; addresses?: unknown; token?: unknown }
    const chain = typeof body.chain === "string" ? getChain(body.chain) : undefined
    if (!chain) throw new AppError("Unknown chain.", 400)
    const addresses = Array.isArray(body.addresses)
      ? body.addresses.filter((item): item is string => typeof item === "string" && ADDRESS.test(item))
      : []
    if (addresses.length > MAX_ADDRESSES) throw new AppError(`Send at most ${MAX_ADDRESSES} addresses per request.`, 400)
    const token = typeof body.token === "string" && ADDRESS.test(body.token) ? body.token : null
    return Response.json(await lookUpWallets(chain, addresses, token))
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500
    const message = error instanceof Error ? error.message : "Could not look up these wallets."
    if (status >= 500) console.error(error)
    return Response.json({ error: message }, { status })
  }
}
