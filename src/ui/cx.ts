/** Склейка классов. Двадцать строк вместо зависимости (§3). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
