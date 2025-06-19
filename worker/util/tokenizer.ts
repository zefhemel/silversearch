import { splitCamelCase, splitHyphens } from "./utils.ts";
import markdownLinkExtractor from "markdown-link-extractor"
import { QueryCombination } from "minisearch";
import { BRACKETS_AND_SPACE, SPACE_OR_PUNCTUATION } from "./global.ts";

export function tokenizeForIndexing(text: string, options: { tokenizeUrls: boolean }): string[] {
    try {
        const words = tokenizeWords(text);
        let urls: string[] = [];
        if (options.tokenizeUrls) {
            try {
                urls = markdownLinkExtractor(text);
            } catch (e) {
                console.log("[Silversearch] Error extracting urls", e);
            }
        }

        let tokens = tokenizeTokens(text, { skipChs: true });
        tokens = [...tokens.flatMap(token => [
            token,
            ...splitHyphens(token),
            ...splitCamelCase(token),
        ]), ...words];

        // Add urls
        if (urls.length) {
            tokens = [...tokens, ...urls];
        }

        // Remove duplicates
        tokens = [...new Set(tokens)];

        return tokens;
    } catch (e) {
        console.error("[Silversearch] Error tokenizing text, skipping document", e);
        return [];
    }
}

export function tokenizeForSearch(text: string): QueryCombination {
    // Extract urls and remove them from the query
    const urls: string[] = markdownLinkExtractor(text);
    text = urls.reduce((acc, url) => acc.replace(url, ''), text);

    const tokens = [...tokenizeTokens(text), ...urls].filter(Boolean);

    return {
        combineWith: 'OR',
        queries: [
            { combineWith: 'AND', queries: tokens },
            {
                combineWith: 'AND',
                queries: tokenizeWords(text).filter(Boolean),
            },
            { combineWith: 'AND', queries: tokens.flatMap(splitHyphens) },
            { combineWith: 'AND', queries: tokens.flatMap(splitCamelCase) },
        ],
    };
}

function tokenizeWords(text: string, { skipChs = false } = {}): string[] {
    const tokens = text.split(BRACKETS_AND_SPACE);
    if (skipChs) return tokens;
    return tokenizeChsWord(tokens);
}

function tokenizeTokens(text: string, { skipChs = false } = {}): string[] {
    const tokens = text.split(SPACE_OR_PUNCTUATION);
    if (skipChs) return tokens;
    return tokenizeChsWord(tokens);
}

function tokenizeChsWord(tokens: string[]): string[] {
    // TODO: Tokenize Chineese
    return tokens;
}
