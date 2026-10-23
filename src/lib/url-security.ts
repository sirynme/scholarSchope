import crypto from 'node:crypto';

// ============================================================================
// URL Normalization, Deduplication, SSRF Protection, robots.txt & Sanitization
// ============================================================================

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'ref',
]);

/**
 * Normalizes a URL into a canonical identity for deduplication.
 * - Enforces http: or https: protocol
 * - Lowercases protocol and hostname
 * - Removes default ports (:80, :443)
 * - Collapses redundant path slashes and removes trailing slash (except root /)
 * - Strips tracking query parameters and sorts remaining query parameters
 * - Strips URL hash fragments (#...)
 */
export function normalizeUrl(rawUrl: string, baseUrl?: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('URL cannot be empty');
  }

  let parsed: URL;
  try {
    parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
  } catch {
    throw new Error(`Invalid URL format: ${rawUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }

  // Collapse duplicate slashes in pathname
  let cleanPath = parsed.pathname.replace(/\/{2,}/g, '/');
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }
  parsed.pathname = cleanPath || '/';

  // Filter out tracking params and sort remaining keys alphabetically
  const keptParams: Array<[string, string]> = [];
  parsed.searchParams.forEach((val, key) => {
    const lowerKey = key.toLowerCase();
    if (!TRACKING_PARAMS.has(lowerKey) && !lowerKey.startsWith('utm_')) {
      keptParams.push([key, val]);
    }
  });
  keptParams.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  const newSearch = new URLSearchParams();
  for (const [k, v] of keptParams) {
    newSearch.append(k, v);
  }
  parsed.search = newSearch.toString() ? `?${newSearch.toString()}` : '';
  parsed.hash = '';

  return parsed.toString();
}

/**
 * Generates a deterministic SHA-256 hex digest for a normalized URL or text snippet.
 */
export function computeSha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Deduplicates an array of candidate URLs, returning unique normalized URLs and skipping invalid/unsafe URLs.
 */
export function deduplicateUrls(rawUrls: string[], baseUrl?: string): {
  validNormalized: string[];
  duplicatesSkipped: number;
  rejectedReasons: Array<{ rawUrl: string; reason: string }>;
} {
  const seen = new Set<string>();
  const validNormalized: string[] = [];
  let duplicatesSkipped = 0;
  const rejectedReasons: Array<{ rawUrl: string; reason: string }> = [];

  for (const raw of rawUrls) {
    try {
      const norm = normalizeUrl(raw, baseUrl);
      const ssrfCheck = validateUrlAgainstSsrf(norm);
      if (!ssrfCheck.allowed) {
        rejectedReasons.push({ rawUrl: raw, reason: ssrfCheck.reason || 'Blocked by SSRF policy' });
        continue;
      }
      if (seen.has(norm)) {
        duplicatesSkipped++;
      } else {
        seen.add(norm);
        validNormalized.push(norm);
      }
    } catch (err: any) {
      rejectedReasons.push({ rawUrl: raw, reason: err?.message || 'Invalid URL' });
    }
  }

  return { validNormalized, duplicatesSkipped, rejectedReasons };
}

/**
 * Checks if an IPv4 address string falls in private, loopback, link-local, or reserved ranges.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();

  // IPv6 loopback, link-local, unique-local, unspecified
  if (
    clean === '::1' ||
    clean === '::' ||
    clean.startsWith('fe80:') ||
    clean.startsWith('fc00:') ||
    clean.startsWith('fd00:') ||
    clean.startsWith('::ffff:127.') ||
    clean.startsWith('::ffff:10.') ||
    clean.startsWith('::ffff:192.168.') ||
    clean.startsWith('::ffff:169.254.')
  ) {
    return true;
  }

  // IPv4 check
  const parts = clean.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map((p) => Number.parseInt(p, 10));
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a >= 224) return true; // Multicast & reserved
  }

  return false;
}

/**
 * Validates a URL against SSRF, local network access, cloud metadata endpoints, and unsafe protocols.
 */
export function validateUrlAgainstSsrf(targetUrl: string): { allowed: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { allowed: false, reason: 'Malformed URL' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { allowed: false, reason: `Disallowed protocol: ${parsed.protocol}` };
  }

  if (parsed.username || parsed.password) {
    return { allowed: false, reason: 'URLs with embedded credentials are prohibited' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    host === 'metadata'
  ) {
    return { allowed: false, reason: `Blocked internal/local hostname: ${host}` };
  }

  if (isPrivateOrReservedIp(host)) {
    return { allowed: false, reason: `Blocked private or reserved IP address: ${host}` };
  }

  return { allowed: true };
}

/**
 * Validates a redirect chain hop to prevent open-redirect-to-internal SSRF attacks.
 */
export function validateRedirectTarget(
  originalUrl: string,
  redirectLocation: string,
  hopCount: number,
  maxHops = 5
): { allowed: boolean; normalizedTarget?: string; reason?: string } {
  if (hopCount > maxHops) {
    return { allowed: false, reason: `Exceeded maximum redirect hops (${maxHops})` };
  }
  try {
    const resolved = normalizeUrl(redirectLocation, originalUrl);
    const check = validateUrlAgainstSsrf(resolved);
    if (!check.allowed) {
      return { allowed: false, reason: `Unsafe redirect blocked: ${check.reason}` };
    }
    return { allowed: true, normalizedTarget: resolved };
  } catch (err: any) {
    return { allowed: false, reason: err?.message || 'Invalid redirect URL' };
  }
}

/**
 * Parses a robots.txt file and checks whether a given URL path is allowed for our user-agent.
 */
export function isAllowedByRobotsTxt(robotsTxtContent: string, urlPath: string, botAgent = 'scholarscope'): boolean {
  if (!robotsTxtContent || !robotsTxtContent.trim()) return true;

  const lines = robotsTxtContent.split(/\r?\n/);
  let currentAgents: string[] = [];
  let seenRuleForCurrentBlock = false;
  const rules: Array<{ agent: string; type: 'allow' | 'disallow'; path: string }> = [];

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      if (seenRuleForCurrentBlock) {
        currentAgents = [];
        seenRuleForCurrentBlock = false;
      }
      currentAgents.push(value.toLowerCase());
    } else if (directive === 'disallow' || directive === 'allow') {
      seenRuleForCurrentBlock = true;
      for (const ag of currentAgents.length ? currentAgents : ['*']) {
        rules.push({ agent: ag, type: directive, path: value });
      }
    }
  }

  const normalizedBot = botAgent.toLowerCase();
  const applicableRules = rules.filter(
    (r) => r.agent === '*' || normalizedBot.includes(r.agent) || r.agent.includes(normalizedBot)
  );

  let matchedRule: { type: 'allow' | 'disallow'; path: string } | null = null;
  for (const rule of applicableRules) {
    if (!rule.path) continue; // Empty Disallow means allow all
    if (urlPath.startsWith(rule.path)) {
      if (!matchedRule || rule.path.length > matchedRule.path.length) {
        matchedRule = rule;
      }
    }
  }

  return matchedRule ? matchedRule.type !== 'disallow' : true;
}

/**
 * Defends against prompt-injection and script injection embedded inside untrusted web pages.
 * Strips script/style tags, hidden zero-width characters, and adversarial LLM override phrases.
 */
export function sanitizeUntrustedWebText(rawText: string, maxLength = 25000): {
  cleanText: string;
  injectionPatternsDetected: string[];
} {
  const injectionPatternsDetected: string[] = [];
  let text = rawText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  const adversarialPatterns: Array<{ name: string; regex: RegExp }> = [
    { name: 'IGNORE_INSTRUCTIONS', regex: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi },
    { name: 'SYSTEM_OVERRIDE', regex: /system\s*prompt\s*override|you\s+are\s+now\s+in\s+developer\s+mode/gi },
    { name: 'FAKE_VERIFICATION', regex: /mark\s+this\s+opportunity\s+as\s+officially\s+confirmed/gi },
  ];

  for (const pat of adversarialPatterns) {
    if (pat.regex.test(text)) {
      injectionPatternsDetected.push(pat.name);
      text = text.replace(pat.regex, '[REDACTED_UNTRUSTED_DIRECTIVE]');
    }
  }

  return {
    cleanText: text.slice(0, maxLength).trim(),
    injectionPatternsDetected,
  };
}

/**
 * Redacts sensitive tokens, passwords, and API keys from log strings.
 */
export function redactSecretsInLog(logLine: string): string {
  return logLine
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1[REDACTED]')
    .replace(/(api[_-]?key|secret|password|token)(["'\s:=]+)([A-Za-z0-9._\-]{6,})/gi, '$1$2[REDACTED]')
    .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://[REDACTED]@');
}
