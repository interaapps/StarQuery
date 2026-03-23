const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function assertIdentifier(identifier: string) {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`)
  }
}
