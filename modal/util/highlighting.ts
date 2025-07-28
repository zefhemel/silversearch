import { SearchMatch } from "../../shared/global";

function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ignoreRegex = /(<br>|&lt;|&gt;|&quot;|&#039;)/g

export function highlightText(text: string, matches: SearchMatch[]): string {
    const highlightClass = "silversearch-highlight"

    if (!matches.length) return text;

    try {
        // Very hacky way to get around replacing text inside the html stuff. A dom parser would probably be better, but much slower
        return text.split(ignoreRegex).map(snippet => {
            if (snippet.match(ignoreRegex)) return snippet;
            return snippet.replace(
                new RegExp(
                    `(${matches.map(item => escapeRegExp(item.match)).join('|')})`,
                    'giu'
                ),
                `<span class="${highlightClass}">$1</span>`
            );
        }).join("");
    } catch (e) {
        console.error('[Silversearch] Error in highlightText()', e);
        return text;
    }
}