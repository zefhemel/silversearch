import { clientStore, editor, space } from "@silverbulletmd/silverbullet/syscalls";
import { PageMeta } from "@silverbulletmd/silverbullet/type/index";
import { SearchResult, Options, default as MiniSearch } from "minisearch"
import { Query } from "./query.ts";
import { getPlugConfig, SilversearchSettings } from "./settings.ts";
import { tokenizeForIndexing, tokenizeForSearch } from "./tokenizer.ts";
import { getGroups, removeDiacritics, stripMarkdownCharacters } from "./utils.ts";
import { CompletePage, IndexableDocument, RecencyCutoff } from "./global.ts";
import { getMatches, makeExcerpt } from "./textprocessing.ts";
import { ResultExcerpt, ResultPage } from "../../shared/global.ts";

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
        await editor.flashNotification("Silversearch - Fully reindexing, this can cause performance problems");
        this.minisearch.removeAll();

        // We only index pages right now
        const pages = await space.listPages();

        console.log(`[Silversearch] Indexing ${pages.length} pages`);

        const cleanedPages: IndexableDocument[] = await Promise.all(pages.map(SearchEngine.pageMetaToIndexablePage));

        await this.minisearch.addAllAsync(cleanedPages);

        await this.writeToCache();

        await editor.flashNotification("Silversearch - Full reindex done!");
    }

    public async indexPage(pageRef: string): Promise<void> {
        await this.indexPages([pageRef]);
    }

    public async indexPages(pageRefs: string[]): Promise<void> {
        for (const pageRef of pageRefs) {
            try {
                console.log(`[Silversearch] Indexing ${pageRef}`);
                const pageMeta = await space.getPageMeta(pageRef);

                const document = await SearchEngine.pageMetaToIndexablePage(pageMeta);

                if (this.minisearch.has(document.ref)) this.minisearch.replace(document);
                else this.minisearch.add(document);
            } catch (_) {
                console.log(`[Silversearch] Failed to index ${pageRef}. Skipping!`);
            }
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
                basename: settings.weights.basename,
                aliases: settings.weights.aliases,
                displayName: settings.weights.displayName,
                directory: settings.weights.directory,
                tags: settings.weights.tags,
                unmarkedTags: settings.weights.tags
            },
            tokenize: text => [text],
            boostDocument(_id, _term, storedFields) {
                if (!storedFields?.lastModified || settings.recencyBoost === RecencyCutoff.Disabled) {
                    return 1;
                }
                const lastModified = storedFields?.lastModified as number;
                const now = new Date().getTime();
                const daysElapsed = (now - lastModified) / (24 * 3600 * 1000);

                // Documents boost
                const cutoff = {
                    [RecencyCutoff.Day]: -3,
                    [RecencyCutoff.Week]: -0.3,
                    [RecencyCutoff.Month]: -0.1,
                } as const;
                return 1 + Math.exp(cutoff[settings.recencyBoost] * (daysElapsed / 1000));
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

        // TODO: This could be heavy on performance. We should also use a map here
        const documents = (await Promise.allSettled(
            results.map(async result => await this.getCompletePage(result.id))
        )).filter((doc) => doc.status === "fulfilled").map((doc) => doc.value);

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


            const metadata = documents.find((d) => d.ref === path)?.metadata;
            if (metadata) {
                // Boost custom properties
                for (const [name, weight] of Object.entries(settings.weightCustomProperties)) {
                    // Get frontmatter property
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
    ): Promise<ResultPage[]> {
        const results = await this.search(query, {
            prefixLength: 1,
            singleFilePath: options?.singleFilePath,
        });

        const documents = (await Promise.allSettled(
            results.map(async result => await this.getCompletePage(result.id))
        )).filter((doc) => doc.status === "fulfilled").map((doc) => doc.value);

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

            let excerpts: ResultExcerpt[];

            if (options?.singleFilePath) {
                let groups = getGroups(matches);

                // If there are quotes in the search,
                // only show results that match at least one of the quotes
                const exactTerms = query.getExactTerms()
                if (exactTerms.length) {
                    groups = groups.filter(group =>
                        exactTerms.every(exact =>
                            group.some(match => match.match.includes(exact))
                        )
                    )
                }

                const groupedOffsets = groups.map(group => Math.round(group.at(0)!.offset));

                excerpts = await Promise.all(groupedOffsets.map(offset => makeExcerpt(note?.content ?? "", offset)));
            } else {
                excerpts = [await makeExcerpt(
                    note.content,
                    matches[0]?.offset ?? -1
                )];
            }

            const resultNote: ResultPage = {
                score: result.score,
                foundWords,
                matches,
                matchesName,
                excerpts,
                ...note,
            };
            return resultNote;
        }));

        return resultNotes.filter(result => result !== null);
    }

    private async getCompletePage(ref: string): Promise<CompletePage> {
        let meta: PageMeta;

        try {
            meta = await space.getPageMeta(ref);
        } catch (_) {
            throw new Error("Couldn't find the specified page");
        }

        const cached = this.documentCache.get(ref);
        if (cached && new Date(meta.lastModified).getTime() === cached.lastModified) return cached;

        const result = await SearchEngine.pageMetaToIndexablePage(meta);

        const metadata = Object.fromEntries(Object.entries(meta).filter(([key, _]) => !["ref", "tag", "tags", "itags", "name", "created", "lastModified", "perm", "lastOpened", "pageDecoration", "aliases"].includes(key)));

        const completePage = {
            ...result,
            cleanedContent: stripMarkdownCharacters(removeDiacritics(result.content)),
            metadata
        }

        this.documentCache.set(ref, completePage);

        return completePage;
    }

    private static async pageMetaToIndexablePage(page: PageMeta): Promise<IndexableDocument> {
        const content = await space.readPage(page.ref);


        return {
            ref: page.name,
            basename: page.name.split("/").pop() ?? page.name,
            directory: page.name.split("/").splice(-1).join() ?? "",
            aliases: page.aliases ?? [],
            displayName: page.displayName ?? "",
            tags: page.tags?.map((tag) => "#" + tag) ?? [],
            unmarkedTags: page.tags ?? [],
            content: content,
            lastModified: new Date(page.lastModified).getTime(),
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
                "displayName"
            ],
            storeFields: [
                "lastModified",
                "tags"
            ]
        }
    }
}