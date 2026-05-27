import { NextRequest, NextResponse } from 'next/server';
import { createFallbackLinkPreview, type LinkPreviewData } from '@/lib/linkPreview';

const PREVIEW_REVALIDATE_SECONDS = 60 * 60;
const MAX_HTML_LENGTH = 200_000;
const RESPONSE_HEADERS = {
  'Cache-Control': `public, max-age=0, s-maxage=${PREVIEW_REVALIDATE_SECONDS}, stale-while-revalidate=${PREVIEW_REVALIDATE_SECONDS}`,
};
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

function decodeHtmlEntities(value?: string | null): string | undefined {
  if (!value) return undefined;

  const decoded = value.replace(/&(amp|quot|#39|lt|gt|nbsp);/g, (entity) => HTML_ENTITIES[entity] ?? entity).trim();
  return decoded || undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMetaContent(html: string, attribute: 'property' | 'name', key: string): string | undefined {
  const escapedKey = escapeRegExp(key);
  const forwardPattern = new RegExp(
    `<meta[^>]+${attribute}=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escapedKey}["'][^>]*>`,
    'i'
  );

  return forwardPattern.exec(html)?.[1] ?? reversePattern.exec(html)?.[1];
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return decodeHtmlEntities(match?.[1]);
}

function resolveUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function mergePreview(fallback: LinkPreviewData, partial: Partial<LinkPreviewData>): LinkPreviewData {
  return {
    ...fallback,
    ...Object.fromEntries(Object.entries(partial).filter(([, value]) => Boolean(value))),
  };
}

function jsonResponse(body: LinkPreviewData, status = 200) {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS });
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let targetUrl: string;
  try {
    const parsed = new URL(rawUrl);
    if (!/^https?:$/i.test(parsed.protocol)) {
      throw new Error('Unsupported protocol');
    }
    targetUrl = parsed.toString();
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  const fallbackPreview = createFallbackLinkPreview(targetUrl);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
      next: { revalidate: PREVIEW_REVALIDATE_SECONDS },
    });

    const finalUrl = response.url || targetUrl;
    const basePreview = createFallbackLinkPreview(finalUrl);

    if (!response.ok) {
      return jsonResponse(basePreview);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('html')) {
      return jsonResponse(basePreview);
    }

    const html = (await response.text()).slice(0, MAX_HTML_LENGTH);
    const preview = mergePreview(basePreview, {
      title:
        decodeHtmlEntities(extractMetaContent(html, 'property', 'og:title')) ??
        decodeHtmlEntities(extractMetaContent(html, 'name', 'twitter:title')) ??
        extractTitle(html),
      description:
        decodeHtmlEntities(extractMetaContent(html, 'property', 'og:description')) ??
        decodeHtmlEntities(extractMetaContent(html, 'name', 'description')) ??
        decodeHtmlEntities(extractMetaContent(html, 'name', 'twitter:description')),
      imageUrl: resolveUrl(
        extractMetaContent(html, 'property', 'og:image') ??
          extractMetaContent(html, 'name', 'twitter:image'),
        finalUrl
      ),
      siteName:
        decodeHtmlEntities(extractMetaContent(html, 'property', 'og:site_name')) ??
        basePreview.siteName,
    });

    return jsonResponse(preview);
  } catch {
    return jsonResponse(fallbackPreview);
  }
}