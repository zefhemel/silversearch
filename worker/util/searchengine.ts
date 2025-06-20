import { clientStore, editor, space } from "@silverbulletmd/silverbullet/syscalls";
import { PageMeta } from "@silverbulletmd/silverbullet/type/index";
import { SearchResult, Options, default as MiniSearch } from "minisearch"
import { Query } from "./query.ts";
import { getPlugConfig, SilversearchSettings } from "./settings.ts";
import { tokenizeForIndexing, tokenizeForSearch } from "./tokenizer.ts";
import { removeDiacritics, stripMarkdownCharacters } from "./utils.ts";
import { CompletePage, IndexableDocument, RecencyCutoff } from "./global.ts";
import { getMatches, makeExcerpt } from "./textprocessing.ts";
import { ResultNote } from "../../shared/global.ts";

export class SearchEngine {
    private minisearch: MiniSearch;
    private documentCache: Map<string, CompletePage>;

    constructor(settings: SilversearchSettings) {
        this.minisearch = new MiniSearch(SearchEngine.getOptions(settings));
        this.documentCache = new Map();
    }

    public async loadFromCache(settings: SilversearchSettings): Promise<boolean> {
        const cache = await clientStore.get("silversearch-cache");

        if (!cache || typeof (cache) !== "string") {
            console.log("[Silversearch] Couldn't find cache");
            await clientStore.del("silversearch-cache");

            return false;
        }

        this.minisearch = await MiniSearch.loadJSONAsync(cache, SearchEngine.getOptions(settings));

        return true;
    }

    public static async deleteCache() {
        await clientStore.del("silversearch-cache");
    }

    public async writeToCache(): Promise<void> {
        const cache = JSON.stringify(this.minisearch);

        await clientStore.set("silversearch-cache", cache);
    }

    public async fullReindex(): Promise<void> {
        await editor.flashNotification("Silversearch: Fully reindexing, this can cause performance problems");
        this.minisearch.removeAll();

        // We only index pages right now
        const pages = await space.listPages();

        const cleanedPages: IndexableDocument[] = await Promise.all(pages.map(SearchEngine.pageMetaToIndexablePage));

        await this.minisearch.addAllAsync(cleanedPages);

        await this.writeToCache();

        await editor.flashNotification("Silversearch: Full reindex done!");
    }

    public async indexPage(pageRef: string): Promise<void> {
        await this.indexPages([pageRef]);
    }

    public async indexPages(pageRefs: string[]): Promise<void> {
        for (const pageRef in pageRefs) {
            const pageMeta = await space.getPageMeta(pageRef);

            const document = await SearchEngine.pageMetaToIndexablePage(pageMeta);

            if (this.minisearch.has(document.ref)) this.minisearch.replace(document);
            else this.minisearch.add(document);
        }

        await this.writeToCache();
    }

    private async search(query: Query, options: { prefixLength: number, singleFilePath?: string }): Promise<SearchResult[]> {
        const settings = await getPlugConfig();

        if (query.isEmpty()) return [];

        const fuzziness: number = {
            "0": 0,
            "1": 0.1,
            "2": 0.2
        }[settings.fuzziness];

        const searchTokens = tokenizeForSearch(query.segmentsToStr())

        let results = this.minisearch.search(searchTokens, {
            prefix: term => term.length >= options.prefixLength,
            // length <= 3: no fuzziness
            // length <= 5: fuzziness of 10%
            // length > 5: fuzziness of 20%
            fuzzy: term =>
                term.length <= 3 ? 0 : term.length <= 5 ? fuzziness / 2 : fuzziness,
            boost: {
                basename: settings.weightBasename,
                aliases: settings.weightBasename,
                displayTitle: settings.weightBasename,
                directory: settings.weightDirectory,
                tags: settings.weightTags,
            },
            tokenize: text => [text],
            boostDocument(_id, _term, storedFields) {
                if (!storedFields?.lastModified || settings.recencyBoost === RecencyCutoff.Disabled) {
                    return 1;
                }
                const lastModified = storedFields?.lastModified as number;
                const now = new Date().valueOf();
                const daysElapsed = (now - lastModified) / (24 * 3600);

                // Documents boost
                const cutoff = {
                    [RecencyCutoff.Day]: -3,
                    [RecencyCutoff.Week]: -0.3,
                    [RecencyCutoff.Month]: -0.1,
                } as const;
                return 1 + Math.exp(cutoff[settings.recencyBoost] * daysElapsed);
            }
        });

        // Filter query results to only keep files that match query.query.ext (if any)
        if (query.query.ext?.length) {
            results = results.filter(r => {
                // ".can" should match ".canvas"
                // If the document doesn't have an extension it's a page
                const ext = r.id.includes(".") ? "." + r.id.split('.').pop() : ".md";
                return query.query.ext?.some(e =>
                    ext.startsWith(e.startsWith('.') ? e : '.' + e)
                );
            });
        }

        // Filter query results that match the path
        if (query.query.path) {
            results = results.filter(r =>
                query.query.path?.some(p =>
                    (r.id as string).toLowerCase().includes(p.toLowerCase())
                )
            );
        }
        if (query.query.exclude.path) {
            results = results.filter(
                r =>
                    !query.query.exclude.path?.some(p =>
                        (r.id as string).toLowerCase().includes(p.toLowerCase())
                    )
            );
        }

        if (!results.length) {
            return [];
        }

        if (options.singleFilePath) {
            return results.filter(r => r.id === options.singleFilePath);
        }

        // Extract tags from the query
        const tags = query.getTags();

        for (const result of results) {
            const path = result.id;
            if (settings.downrankedFoldersFilters.length > 0) {
                // downrank files that are in folders listed in the downrankedFoldersFilters
                let downrankingFolder = false;

                settings.downrankedFoldersFilters.forEach(filter => {
                    if (path.startsWith(filter)) {
                        // we don't want the filter to match the folder sources, e.g.
                        // it needs to match a whole folder name
                        if (path === filter || path.startsWith(filter + '/')) downrankingFolder = true;
                    }
                })

                if (downrankingFolder) result.score /= 10;

                const pathParts = path.split('/');
                const pathPartsLength = pathParts.length;

                for (let i = 0; i < pathPartsLength; i++) {
                    const pathPart = pathParts[i];
                    if (settings.downrankedFoldersFilters.includes(pathPart)) {
                        result.score /= 10;
                        break;
                    }
                }
            }


            const metadata = await space.getPageMeta(path);
            if (metadata) {
                // Boost custom properties
                for (const { name, weight } of settings.weightCustomProperties) {
                    const values = metadata[name];
                    if (values && result.terms.some(t => values.includes(t))) {
                        result.score *= weight;
                    }
                }
            }

            // Put the results with tags on top
            for (const tag of tags) {
                if ((result.tags ?? []).includes(tag)) {
                    result.score *= 100;
                }
            }
        }

        // Sort results and keep the 50 best
        results = results.sort((a, b) => b.score - a.score).slice(0, 50);

        // TODO: This could be heavy on performance
        const documents = await Promise.all(
            results.map(async result => await this.getCompletePage(result.id))
        );

        // If the search query contains quotes, filter out results that don't have the exact match
        const exactTerms = query.getExactTerms();
        if (exactTerms.length) {
            results = results.filter(r => {
                const document = documents.find(d => d.ref === r.id);
                const title = document?.ref.toLowerCase() ?? "";
                const content = (document?.cleanedContent ?? "").toLowerCase();
                return exactTerms.every(
                    q =>
                        content.includes(q) ||
                        removeDiacritics(
                            title,
                            settings.ignoreArabicDiacritics
                        ).includes(q)
                );
            });
        }

        // If the search query contains exclude terms, filter out results that have them
        const exclusions = query.query.exclude.text;
        if (exclusions.length) {
            results = results.filter(r => {
                const content = (
                    documents.find(d => d.ref === r.id)?.content ?? ""
                ).toLowerCase();
                return exclusions.every(q => !content.includes(q));
            });
        }

        return results;
    }

    public async getSuggestions(
        query: Query,
        options?: Partial<{ singleFilePath?: string }>
    ): Promise<ResultNote[]> {
        const results = await this.search(query, {
            prefixLength: 1,
            singleFilePath: options?.singleFilePath,
        });

        const documents = await Promise.all(
            results.map(async result => await this.getCompletePage(result.id))
        );

        // TODO: Embedding ??

        // Map the raw results to get usable suggestions
        const resultNotes = await Promise.all(results.map(async result => {
            const note = documents.find(d => d.ref === result.id)
            if (!note) {
                console.warn(`Silversearch - Note "${result.id}" disappeared. Skipping`);
                return null;
            }

            // Clean search matches that match quoted expressions,
            // and inject those expressions instead
            const foundWords = [
                // Matching terms from the result,
                // do not necessarily match the query
                ...result.terms,

                // Quoted expressions
                ...query.getExactTerms(),

                // Tags, starting with #
                ...query.getTags(),
            ]

            const matches = await getMatches(
                note.content,
                foundWords,
                query
            );

            // Generating these here is a little performance heavy but safes us from having a lot of doubled code in the frontend
            const matchesName = await getMatches(
                note.ref,
                foundWords
            );

            const excerpt = await makeExcerpt(
                note.content,
                matches[0]?.offset ?? -1
            )

            const resultNote: ResultNote = {
                score: result.score,
                foundWords,
                matches,
                matchesName,
                excerpt,
                ...note,
            };
            return resultNote;
        }));

        return resultNotes.filter(result => result !== null);
    }

    private async getCompletePage(ref: string): Promise<CompletePage> {
        const meta = await space.getPageMeta(ref);

        const result = await SearchEngine.pageMetaToIndexablePage(meta);

        return {
            ...result,
            cleanedContent: stripMarkdownCharacters(removeDiacritics(result.content)),
        }
    }

    private static async pageMetaToIndexablePage(page: PageMeta): Promise<IndexableDocument> {
        const content = await space.readPage(page.ref);

        return {
            ref: page.name,
            basename: page.name.split("/").pop() ?? page.name,
            directory: page.name.split("/").splice(-1).join() ?? "",
            aliases: page.aliases ?? [],
            tags: page.tags ?? [],
            content: content,
            lastModified: parseInt(page.lastModified),
        }
    }

    private static getOptions(settings: SilversearchSettings): Options<IndexableDocument> {
        return {
            tokenize: (text: string) => tokenizeForIndexing(text, { tokenizeUrls: settings.tokenizeUrls }),
            processTerm: (term: string) => (settings.ignoreDiacritics
                ? removeDiacritics(term, settings.ignoreArabicDiacritics)
                : term
                ).toLowerCase(),
            idField: "ref",
            fields: [
                "content",
                "basename",
                "directory",
                "aliases",
                "tags"
            ]
            // storeFields: ['tags', 'mtime'],
        }
    }
}