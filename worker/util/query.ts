import { removeDiacritics } from "./utils.ts";
import { parse } from "search-query-parser";

const keywords = ["ext", "path"] as const;

type Keywords = {
    [K in typeof keywords[number]]?: string[]
} & { text: string[] }

export class Query {
    query: Keywords & {
        exclude: Keywords
    };
    #inQuotes: string[];

    constructor(text = "", options: { ignoreDiacritics: boolean, ignoreArabicDiacritics: boolean }) {
        if (options.ignoreDiacritics) {
            text = removeDiacritics(text, options.ignoreArabicDiacritics);
        }
        const parsed = parse(text.toLowerCase(), {
            tokenize: true,
            keywords: keywords as unknown as string[],
        }) as unknown as typeof this.query;

        // Default values
        parsed.text = parsed.text ?? [];
        parsed.exclude = parsed.exclude ?? { text: [] };
        parsed.exclude.text = parsed.exclude.text ?? [];
        if (!Array.isArray(parsed.exclude.text)) {
            parsed.exclude.text = [parsed.exclude.text];
        }
        // Remove empty excluded strings
        parsed.exclude.text = parsed.exclude.text.filter(o => o.length);

        // Make sure that all fields are string[]
        for (const k of keywords) {
            const v = parsed[k]
            if (v) {
                parsed[k] = Array.isArray(v) ? v : [v];
            }
            const e = parsed.exclude[k];
            if (e) {
                parsed.exclude[k] = Array.isArray(e) ? e : [e];
            }
        }
        this.query = parsed;

        // Extract keywords starting with a dot...
        const ext = this.query.text
            .filter(o => o.startsWith('.'))
            .map(o => o.slice(1));
        // add them to the ext field...
        this.query.ext = [...new Set([...ext, ...(this.query.ext ?? [])])];
        // and remove them from the text field
        this.query.text = this.query.text.filter(o => !o.startsWith('.'));

        // Get strings in quotes, and remove the quotes
        this.#inQuotes =
            text.match(/"([^"]+)"/g)?.map(o => o.replace(/"/g, '')) ?? [];
    }

    public isEmpty(): boolean {
        for (const k of keywords) {
            if (this.query[k]?.length) {
                return false
            }
            if (this.query.text.length) {
                return false
            }
        }
        return true
    }

    public segmentsToStr(): string {
        return this.query.text.join(' ');
    }

    public getTags(): string[] {
        return this.query.text.filter(o => o.startsWith('#'));
    }

    public getTagsWithoutHashtag(): string[] {
        return this.getTags().map(o => o.replace(/^#/, ''));
    }

    /**
     *
     * @returns An array of strings that are in quotes
     */
    public getExactTerms(): string[] {
        return [
            ...new Set(
                [
                    ...this.query.text.filter(o => o.split(' ').length > 1),
                    ...this.#inQuotes,
                ].map(str => str.toLowerCase())
            ),
        ];
    }

    public getBestStringForExcerpt(): string {
        // If we have quoted expressions, return the longest one
        if (this.#inQuotes.length) {
            return this.#inQuotes.sort((a, b) => b.length - a.length)[0] ?? '';
        }
        // Otherwise, just return the query as is
        return this.segmentsToStr();
    }
}