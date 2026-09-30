import { AppError } from "@/lib/http"
import { getSwapPage } from "@/lib/history"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown; cursor?: unknown }
    const url = typeof body.url === "string" ? body.url : ""
    const cursor = typeof body.cursor === "string" && body.cursor ? body.cursor : null
    if (!url.trim()) {
      throw new AppError("Paste a DEXTools pair-explorer URL.", 400)
    }
    const page = await getSwapPage(url, cursor)
    return Response.json(page)
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500
    const message = error instanceof Error ? error.message : "Could not load swaps."
    if (status >= 500) console.error(error)
    return Response.json({ error: message }, { status })
  }
}
