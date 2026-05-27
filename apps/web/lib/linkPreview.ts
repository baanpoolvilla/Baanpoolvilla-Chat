export interface LinkPreviewData {
  url: string;
  hostname: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

const URL_PATTERN = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

function stripTrailingPunctuation(candidate: string): string {
  let url = candidate.trim();

  while (/[),.;!?]$/.test(url)) {
    const lastChar = url[url.length - 1];
    if (lastChar === ')') {
      const openParens = (url.match(/\(/g) ?? []).length;
      const closeParens = (url.match(/\)/g) ?? []).length;
      if (closeParens <= openParens) {
        break;
      }
    }

    url = url.slice(0, -1);
  }

  return url;
}

export function normalizeUrl(rawUrl: string): string {
  const trimmed = stripTrailingPunctuation(rawUrl);
  if (!trimmed) return '';

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN) ?? [];
  const uniqueUrls = new Set<string>();

  for (const match of matches) {
    const normalized = normalizeUrl(match);
    if (normalized) {
      uniqueUrls.add(normalized);
    }
  }

  return [...uniqueUrls];
}

export function getHostname(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

export function createFallbackLinkPreview(url: string): LinkPreviewData {
  const normalizedUrl = normalizeUrl(url);
  const hostname = getHostname(normalizedUrl);

  return {
    url: normalizedUrl,
    hostname,
    siteName: hostname,
  };
}