import { editor } from "@silverbulletmd/silverbullet/syscalls";
import { excerptAfter, excerptBefore } from "./global.ts";
import { Query } from "./query.ts";
import { getPlugConfig } from "./settings.ts";
import { removeDiacritics } from "./utils.ts";
import { SearchMatch } from "../../shared/global.ts";

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stringsToRegex(strings: string[]): RegExp {
    if (!strings.length) return /^$/g;

    // sort strings by decreasing length, so that longer strings are matched first
    strings.sort((a, b) => b.length - a.length);

    const joined = `(${strings
        .map(s => `\\b${escapeRegExp(s)}\\b|${escapeRegExp(s)}`)
        .join('|')})`;

    return new RegExp(`${joined}`, 'gui');
}

export async function getMatches(
    text: string,
    words: string[],
    query?: Query
): Promise<SearchMatch[]> {
    const settings = await getPlugConfig();

    words = words.map(escapeHTML);
    const reg = stringsToRegex(words);
    const originalText = text;

    if (settings.ignoreDiacritics) {
        text = removeDiacritics(text, settings.ignoreArabicDiacritics);
    }

    const startTime = new Date().getTime();
    let match: RegExpExecArray | null = null;
    const matches: SearchMatch[] = [];
    let count = 0;
    while ((match = reg.exec(text)) !== null) {
        // Avoid infinite loops, stop looking after 100 matches or if we're taking too much time
        if (++count >= 100 || new Date().getTime() - startTime > 50) break;

        const matchStartIndex = match.index;
        const matchEndIndex = matchStartIndex + match[0].length;
        const originalMatch = originalText
            .substring(matchStartIndex, matchEndIndex)
            .trim();

        if (originalMatch && match.index >= 0) {
            matches.push({ match: originalMatch, offset: match.index });
        }
    }

    // If the query is more than 1 token and can be found "as is" in the text, put this match first
    if (query && (query.query.text.length > 1 || query.getExactTerms().length > 0)) {
        const best = text.indexOf(query.getBestStringForExcerpt());
        if (best > -1 && matches.find(m => m.offset === best)) {
            matches.unshift({
                offset: best,
                match: query.getBestStringForExcerpt(),
            });
        }
    }

    return matches;
}

export async function makeExcerpt(content: string, offset: number): Promise<string> {
    const settings = await getPlugConfig();

    try {
        const pos = offset ?? -1;
        const from = Math.max(0, pos - excerptBefore);
        const to = Math.min(content.length, pos + excerptAfter);
        if (pos > -1) {
            content =
                (from > 0 ? '…' : '') +
                content.slice(from, to).trim() +
                (to < content.length - 1 ? '…' : '');
        } else {
            content = content.slice(0, excerptAfter);
        }
        if (settings.renderLineReturnInExcerpts) {
            const lineReturn = new RegExp(/(?:\r\n|\r|\n)/g);
            // Remove multiple line returns
            content = content
                .split(lineReturn)
                .filter(l => l)
                .join('\n');

            const last = content.lastIndexOf('\n', pos - from);

            if (last > 0) {
                content = content.slice(last);
            }
        }

        content = escapeHTML(content);

        if (settings.renderLineReturnInExcerpts) {
            content = content.trim().replaceAll('\n', '<br>');
        }

        return content;
    } catch (e) {
        await editor.flashNotification("Silversearch - Error while creating excerpt, see developer console", "error");
        console.error("[Silversearch] Error while creating excerpt", e);
        return "";
    }
}


export function escapeHTML(html: string): string {
    return html
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}