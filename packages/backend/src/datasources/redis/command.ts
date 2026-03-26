const READ_ONLY_REDIS_COMMANDS = new Set([
  "BITCOUNT",
  "DBSIZE",
  "EXISTS",
  "GET",
  "GETDEL",
  "GETEX",
  "GETRANGE",
  "HGET",
  "HGETALL",
  "HEXISTS",
  "HKEYS",
  "HLEN",
  "HMGET",
  "HSCAN",
  "HSTRLEN",
  "HVALS",
  "INFO",
  "KEYS",
  "LINDEX",
  "LLEN",
  "LOLWUT",
  "LRANGE",
  "MGET",
  "PING",
  "PTTL",
  "RANDOMKEY",
  "SCAN",
  "SCARD",
  "SISMEMBER",
  "SMEMBERS",
  "SRANDMEMBER",
  "SSCAN",
  "STRLEN",
  "TIME",
  "TTL",
  "TYPE",
  "XLEN",
  "XRANGE",
  "XREVRANGE",
  "ZCARD",
  "ZRANGE",
  "ZRANGEBYSCORE",
  "ZRANK",
  "ZREVRANGE",
  "ZREVRANGEBYSCORE",
  "ZREVRANK",
  "ZSCAN",
  "ZSCORE",
]);

function pushToken(tokens: string[], current: string) {
  if (current) {
    tokens.push(current);
  }
}

export function parseRedisCommand(command: string) {
  const source = command.trim();
  const tokens: string[] = [];

  if (!source) {
    return tokens;
  }

  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const character of source) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      pushToken(tokens, current);
      current = "";
      continue;
    }

    current += character;
  }

  if (quote) {
    throw new Error(
      "The Redis command contains an unterminated quoted string.",
    );
  }

  if (escaped) {
    current += "\\";
  }

  pushToken(tokens, current);
  return tokens;
}

export function isReadOnlyRedisCommand(command: string) {
  const tokens = parseRedisCommand(command);
  return isReadOnlyRedisTokens(tokens);
}

export function isReadOnlyRedisTokens(tokens: string[]) {
  if (!tokens.length) {
    return true;
  }

  return READ_ONLY_REDIS_COMMANDS.has(tokens[0]!.toUpperCase());
}
