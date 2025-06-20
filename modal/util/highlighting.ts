import { SearchMatch } from "../../shared/global";

function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightText(text: string, matches: SearchMatch[]): string {
    const highlightClass = "silversearch-highlight"

    if (!matches.length) return text;

    try {
        return text.replace(
            new RegExp(
                `(${matches.map(item => escapeRegExp(item.match)).join('|')})`,
                'giu'
            ),
            `<span class="${highlightClass}">$1</span>`
        );
    } catch (e) {
        console.error('Silversearch - Error in highlightText()', e);
        return text;
    }
}