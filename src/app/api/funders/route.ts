import { getChain } from "@/lib/chains"
import { resolveFunders } from "@/lib/funded"
import { AppError } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_MAKERS = 12
const BUDGET_MS = 45000
const ADDRESS = /^0x[a-fA-F0-9]{40}$/

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { chain?: unknown; makers?: unknown }
    const chain = typeof body.chain === "string" ? getChain(body.chain) : undefined
    if (!chain) throw new AppError("Unknown chain.", 400)
    const makers = Array.isArray(body.makers)
      ? body.makers.filter((item): item is string => typeof item === "string" && ADDRESS.test(item))
      : []
    if (makers.length === 0) return Response.json({ funders: {}, failed: [] })
    if (makers.length > MAX_MAKERS) throw new AppError(`Send at most ${MAX_MAKERS} wallets per request.`, 400)

    const { found, failed } = await resolveFunders(chain, makers, Date.now() + BUDGET_MS)
    const funders: Record<string, { address: string; label: string }> = {}
    for (const [maker, funder] of found) funders[maker] = funder
    return Response.json({ funders, failed })
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500
    const message = error instanceof Error ? error.message : "Could not look up who funded these wallets."
    if (status >= 500) console.error(error)
    return Response.json({ error: message }, { status })
  }
}
