const SECRET_PATTERNS = [
  /(api[_-]?key)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /(token)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /(password)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /(authorization)\s*:\s*(bearer)\s+([^\s,;]+)/gi
];

export function redactSecrets(input: string): string {
  return SECRET_PATTERNS.reduce((value, pattern) => {
    return value.replace(pattern, (_match, key, maybeBearer) => {
      if (typeof maybeBearer === "string" && maybeBearer.toLowerCase() === "bearer") {
        return `${key}: Bearer [REDACTED]`;
      }
      return `${key}: [REDACTED]`;
    });
  }, input);
}
