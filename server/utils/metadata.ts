export interface LinkMetadata {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
}

const USER_AGENT = 'SlashOrSmashBot/1.0 (+http://slash-or-smash.local)';

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml',
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`Failed to fetch metadata for ${url}: ${response.status}`);
            return {};
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/html')) {
            return {};
        }

        const html = await response.text();
        return parseMetadata(html);
    } catch (error) {
        console.warn(`Error fetching metadata for ${url}:`, error);
        return {};
    }
}

function parseMetadata(html: string): LinkMetadata {
    const metadata: LinkMetadata = {};

    // Helper to extract content from meta tags
    const getMeta = (property: string): string | undefined => {
        // Look for <meta property="og:title" content="..."> or <meta name="description" content="...">
        const regex = new RegExp(`<meta\\s+(?:property|name)=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
        const match = html.match(regex);
        return match ? decodeHtmlEntities(match[1]) : undefined;
    };

    // Title
    metadata.title = getMeta('og:title') || getMeta('twitter:title');
    if (!metadata.title) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) metadata.title = decodeHtmlEntities(titleMatch[1]);
    }

    // Description
    metadata.description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description');

    // Image
    metadata.image = getMeta('og:image') || getMeta('twitter:image');

    // Site Name
    metadata.siteName = getMeta('og:site_name');

    return metadata;
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
