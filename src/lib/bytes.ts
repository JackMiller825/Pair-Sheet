export function hexToUtf8(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) return ""
  const bytes = new Uint8Array(clean.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16)
  }
  return new TextDecoder().decode(bytes).replace(/\0+$/g, "")
}

export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "")
}

export function decodeBase64Url(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
