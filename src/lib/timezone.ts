export const AUTO_ZONE = "auto"

export function detectZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export function resolveZone(choice: string): string {
  const zone = choice === AUTO_ZONE ? detectZone() : choice
  return isValidZone(zone) ? zone : "UTC"
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone })
    return true
  } catch {
    return false
  }
}

function parts(date: Date, zone: string, extra: Intl.DateTimeFormatOptions = {}) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...extra,
  })
  const map: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) map[part.type] = part.value
  return map
}

// "2024-08-04 15:54:23" in the chosen zone, for the CSV.
export function formatZoned(iso: string, zone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const p = parts(date, zone)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}

// "Aug 4 24 15:54:23" in the chosen zone, for the table.
export function formatTradeDate(iso: string, zone = "UTC"): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const p = parts(date, zone, { month: "short", day: "numeric", year: "2-digit" })
  return `${p.month} ${p.day} ${p.year} ${p.hour}:${p.minute}:${p.second}`
}

// Short name such as "UTC", "GMT+9" or "PDT" for the column header.
export function zoneAbbreviation(zone: string, at = new Date()): string {
  return parts(at, zone, { timeZoneName: "short" }).timeZoneName ?? zone
}

export function offsetMinutes(zone: string, at = new Date()): number {
  const p = parts(at, zone)
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000)
}

export function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`
}

export type ZoneOption = { value: string; label: string }

export function zoneOptions(at = new Date()): ZoneOption[] {
  let names: string[] = []
  try {
    names = (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone")
  } catch {
    names = []
  }
  if (!names.includes("UTC")) names = ["UTC", ...names]
  return names
    .map((name) => ({ name, minutes: offsetMinutes(name, at) }))
    .sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name))
    .map(({ name, minutes }) => ({ value: name, label: `(${offsetLabel(minutes)}) ${name.replace(/_/g, " ")}` }))
}
