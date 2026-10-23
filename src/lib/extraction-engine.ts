import crypto from 'node:crypto';
import { ChangeEventRecord, NotificationRecord } from './types';
import { computeSha256, normalizeUrl, sanitizeUntrustedWebText } from './url-security';

// ============================================================================
// Live HTML / Structured Metadata / Sitemap Extraction & Change Detection (Sections 6 & 12)
// ============================================================================

export interface ExtractedPageArtifacts {
  title: string | null;
  cleanText: string;
  contentHash: string;
  structuredJsonLd: Record<string, any>[];
  discoveredLinks: string[];
  extractedDeadlines: Array<{ rawDateText: string; isoDate: string | null; excerpt: string }>;
  extractedGpaClaims: Array<{ value: string; scale: string; excerpt: string }>;
  extractedLanguageClaims: Array<{ test: string; score: string; excerpt: string }>;
  extractedFundingClaims: Array<{ type: 'TUITION' | 'STIPEND'; value: string; excerpt: string }>;
  injectionAlerts: string[];
}

/**
 * Strips HTML boilerplate (nav, footer, scripts, styles, SVGs) so navigation updates or formatting
 * changes do not trigger false-positive ChangeEvents (Section 12).
 */
export function stripHtmlBoilerplate(rawHtml: string): {
  title: string | null;
  mainText: string;
  jsonLdBlocks: Record<string, any>[];
  hrefLinks: string[];
} {
  const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : null;

  // Extract JSON-LD blocks
  const jsonLdBlocks: Record<string, any>[] = [];
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdRegex.exec(rawHtml)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === 'object') {
        jsonLdBlocks.push(parsed);
      }
    } catch {
      // Ignore malformed JSON-LD in untrusted page
    }
  }

  // Extract anchor hrefs
  const hrefLinks: string[] = [];
  const hrefRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;
  while ((match = hrefRegex.exec(rawHtml)) !== null) {
    const rawHref = match[1].trim();
    if (rawHref && !rawHref.startsWith('javascript:') && !rawHref.startsWith('mailto:') && !rawHref.startsWith('tel:')) {
      hrefLinks.push(rawHref);
    }
  }

  // Remove nav, header, footer, script, style, noscript, svg, aside to isolate substantive content
  const bodyWithoutBoilerplate = rawHtml
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');

  const decoded = decodeHtmlEntities(bodyWithoutBoilerplate)
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title,
    mainText: decoded,
    jsonLdBlocks,
    hrefLinks,
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isNaN(code) ? _m : String.fromCodePoint(code);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isNaN(code) ? _m : String.fromCodePoint(code);
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&pound;/gi, '£')
    .replace(/&euro;/gi, '€');
}

/**
 * Parses explicit dates from text without inventing or inferring a current year when the year is missing (Section 6).
 */
export function parseExplicitDeadline(rawText: string): {
  isoDate: string | null;
  hasExplicitYear: boolean;
} {
  // Match "15 December 2026", "December 15, 2026", "2026-12-15", "15 Oct 2026", etc.
  const isoMatch = rawText.match(/\b(202[5-9])-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[0]}T23:59:59Z`);
    if (!Number.isNaN(d.getTime())) {
      return { isoDate: d.toISOString(), hasExplicitYear: true };
    }
  }

  const monthNames =
    '(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)';

  // Day Month Year e.g. "15 December 2026" or "2 December 2026"
  const dmyRegex = new RegExp(`\\b(\\d{1,2})\\s+${monthNames}\\s+(202[5-9])\\b`, 'i');
  const dmyMatch = rawText.match(dmyRegex);
  if (dmyMatch) {
    const parsed = new Date(`${dmyMatch[2]} ${dmyMatch[1]}, ${dmyMatch[3]} 23:59:59 UTC`);
    if (!Number.isNaN(parsed.getTime())) {
      return { isoDate: parsed.toISOString(), hasExplicitYear: true };
    }
  }

  // Month Day, Year e.g. "December 15, 2026"
  const mdyRegex = new RegExp(`\\b${monthNames}\\s+(\\d{1,2}),?\\s+(202[5-9])\\b`, 'i');
  const mdyMatch = rawText.match(mdyRegex);
  if (mdyMatch) {
    const parsed = new Date(`${mdyMatch[1]} ${mdyMatch[2]}, ${mdyMatch[3]} 23:59:59 UTC`);
    if (!Number.isNaN(parsed.getTime())) {
      return { isoDate: parsed.toISOString(), hasExplicitYear: true };
    }
  }

  // If a date has no explicit year (e.g., "December 15"), DO NOT manufacture a year!
  return { isoDate: null, hasExplicitYear: false };
}

/**
 * Extracts structured evidence claims and relevant child links from live HTML or XML content.
 */
export function extractArtifactsFromHtml(rawHtml: string, sourceUrl: string): ExtractedPageArtifacts {
  const { title, mainText, jsonLdBlocks, hrefLinks } = stripHtmlBoilerplate(rawHtml);
  const { cleanText, injectionPatternsDetected } = sanitizeUntrustedWebText(mainText, 40000);
  const contentHash = computeSha256(cleanText);

  // Discover relevant official graduate/scholarship links on the same or official domains
  const discoveredLinks: string[] = [];
  const seenUrls = new Set<string>();
  for (const href of hrefLinks) {
    try {
      const norm = normalizeUrl(href, sourceUrl);
      if (
        !seenUrls.has(norm) &&
        /\b(scholarship|funding|graduate|master|phd|admission|eligibility|apply|fellowship|award|stipend)\b/i.test(norm)
      ) {
        seenUrls.add(norm);
        discoveredLinks.push(norm);
      }
    } catch {
      // skip invalid links
    }
  }

  // Split text into sentence-like windows for supporting excerpt extraction
  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 500);

  const extractedDeadlines: ExtractedPageArtifacts['extractedDeadlines'] = [];
  const extractedGpaClaims: ExtractedPageArtifacts['extractedGpaClaims'] = [];
  const extractedLanguageClaims: ExtractedPageArtifacts['extractedLanguageClaims'] = [];
  const extractedFundingClaims: ExtractedPageArtifacts['extractedFundingClaims'] = [];

  for (const sentence of sentences) {
    // 1. Deadlines
    if (/\b(deadline|closing date|applications close|apply by|submission date|november|december|january|october)\b/i.test(sentence)) {
      const parsed = parseExplicitDeadline(sentence);
      if (parsed.hasExplicitYear && parsed.isoDate && extractedDeadlines.length < 4) {
        extractedDeadlines.push({
          rawDateText: parsed.isoDate.slice(0, 10),
          isoDate: parsed.isoDate,
          excerpt: sentence,
        });
      }
    }

    // 2. GPA / Academic Honors
    if (/\b(gpa|first-class|first class|upper second|2:1|grade point average|minimum grade)\b/i.test(sentence)) {
      const gpaMatch = sentence.match(/\b([34]\.\d{1,2})\s*(?:out of|\/)\s*4\.0\b/i);
      if (gpaMatch && extractedGpaClaims.length < 3) {
        extractedGpaClaims.push({
          value: gpaMatch[1],
          scale: '4.0',
          excerpt: sentence,
        });
      } else if (/\b(first-class|first class)\b/i.test(sentence) && extractedGpaClaims.length < 3) {
        extractedGpaClaims.push({
          value: 'First Class',
          scale: 'UK_HONORS',
          excerpt: sentence,
        });
      } else if (/\b(2:1|upper second)\b/i.test(sentence) && extractedGpaClaims.length < 3) {
        extractedGpaClaims.push({
          value: '2:1',
          scale: 'UK_HONORS',
          excerpt: sentence,
        });
      }
    }

    // 3. Language scores
    const ieltsMatch = sentence.match(/\bIELTS\b[^.]{0,40}?\b([678]\.[05]|[678])\b/i);
    if (ieltsMatch && extractedLanguageClaims.length < 3) {
      extractedLanguageClaims.push({
        test: 'IELTS',
        score: ieltsMatch[1],
        excerpt: sentence,
      });
    }
    const toeflMatch = sentence.match(/\bTOEFL\b[^.]{0,40}?\b(9\d|1[01]\d)\b/i);
    if (toeflMatch && extractedLanguageClaims.length < 3) {
      extractedLanguageClaims.push({
        test: 'TOEFL_IBT',
        score: toeflMatch[1],
        excerpt: sentence,
      });
    }

    // 4. Funding & Stipends
    if (/\b(full cost|tuition fees|maintenance allowance|stipend|chf|gbp|£|\$|living expenses|fellowship covers)\b/i.test(sentence)) {
      const stipendMatch = sentence.match(/(?:£|GBP\s*|CHF\s*|\$|USD\s*|EUR\s*|€)\s*(\d{1,3}(?:,\d{3})+)/i);
      if (stipendMatch && extractedFundingClaims.length < 4) {
        extractedFundingClaims.push({
          type: 'STIPEND',
          value: stipendMatch[0].trim(),
          excerpt: sentence,
        });
      } else if (/\b(full cost|full tuition|100%\s*tuition|tuition fees in full|composition fee)\b/i.test(sentence) && extractedFundingClaims.length < 4) {
        extractedFundingClaims.push({
          type: 'TUITION',
          value: '100% Tuition Covered',
          excerpt: sentence,
        });
      }
    }
  }

  return {
    title,
    cleanText: cleanText.slice(0, 5000),
    contentHash,
    structuredJsonLd: jsonLdBlocks,
    discoveredLinks: discoveredLinks.slice(0, 25),
    extractedDeadlines,
    extractedGpaClaims,
    extractedLanguageClaims,
    extractedFundingClaims,
    injectionAlerts: injectionPatternsDetected,
  };
}

/**
 * Compares a new observation against a previous observation (Section 12).
 * Critical Rules:
 * - Never treat a failed fetch (httpStatus >= 400 or null) as proof that an opportunity has closed!
 * - Ignore navigation/formatting changes where normalized claim values did not change.
 */
export function detectGenuineChanges(params: {
  entityType: ChangeEventRecord['entityType'];
  entityId: string;
  entityTitle: string;
  sourceUrl: string;
  httpStatus: number | null;
  previousFields: Record<string, string | null | undefined>;
  newFields: Record<string, string | null | undefined>;
  now?: Date;
}): {
  changeEvents: ChangeEventRecord[];
  sourceFailedWithoutClosing: boolean;
} {
  const nowIso = (params.now || new Date()).toISOString();

  // Rule: Never treat a failed fetch as proof that an opportunity has closed
  if (!params.httpStatus || params.httpStatus >= 400) {
    return {
      changeEvents: [],
      sourceFailedWithoutClosing: true,
    };
  }

  const changeEvents: ChangeEventRecord[] = [];
  for (const [field, newValRaw] of Object.entries(params.newFields)) {
    const prevValRaw = params.previousFields[field];
    const prevNorm = (prevValRaw ?? '').toString().trim();
    const newNorm = (newValRaw ?? '').toString().trim();

    // Only emit a change event if the new value is non-empty and substantively differs from previous
    if (newNorm && prevNorm && prevNorm.toLowerCase() !== newNorm.toLowerCase()) {
      changeEvents.push({
        id: crypto.randomUUID(),
        entityType: params.entityType,
        entityId: params.entityId,
        entityTitle: params.entityTitle,
        fieldChanged: field,
        previousValue: prevNorm,
        newValue: newNorm,
        sourceUrl: params.sourceUrl,
        isGenuineChange: true,
        detectedAt: nowIso,
      });
    }
  }

  return {
    changeEvents,
    sourceFailedWithoutClosing: false,
  };
}

/**
 * Generates deduplicated notifications (Section 12).
 * Enforces:
 * - Unique `dedupeKey` prevents duplicate alerts across repeated runs.
 * - Never issues ordinary deadline reminders for unverified dates without explicitly marking uncertainty (`isUncertainDate: true`).
 */
export function createDeduplicatedNotification(
  existingNotifications: NotificationRecord[],
  input: {
    userId: string;
    dedupeKey: string;
    category: NotificationRecord['category'];
    title: string;
    message: string;
    sourceUrl?: string | null;
    isVerifiedDate?: boolean;
  },
  now: Date = new Date()
): {
  notifications: NotificationRecord[];
  created: NotificationRecord | null;
  wasDuplicate: boolean;
} {
  const alreadyExists = existingNotifications.some(
    (n) => n.userId === input.userId && n.dedupeKey === input.dedupeKey
  );
  if (alreadyExists) {
    return {
      notifications: existingNotifications,
      created: null,
      wasDuplicate: true,
    };
  }

  const isUncertainDate =
    input.category === 'DEADLINE_REMINDER' && input.isVerifiedDate === false;

  const finalTitle = isUncertainDate
    ? `[UNVERIFIED DATE] ${input.title}`
    : input.title;
  const finalMessage = isUncertainDate
    ? `${input.message} (Note: This deadline date is not yet officially confirmed; verify directly on the application portal.)`
    : input.message;

  const record: NotificationRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    dedupeKey: input.dedupeKey,
    category: input.category,
    title: finalTitle,
    message: finalMessage,
    sourceUrl: input.sourceUrl ?? null,
    isUncertainDate,
    read: false,
    createdAt: now.toISOString(),
  };

  return {
    notifications: [record, ...existingNotifications],
    created: record,
    wasDuplicate: false,
  };
}
