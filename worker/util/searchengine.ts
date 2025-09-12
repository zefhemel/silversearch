import { clientStore, editor, space } from "@silverbulletmd/silverbullet/syscalls";
import { DocumentMeta, PageMeta } from "@silverbulletmd/silverbullet/type/index";
import { SearchResult, Options, default as MiniSearch } from "minisearch"
import { Query } from "./query.ts";
import { getPlugConfig, SilversearchSettings } from "./settings.ts";
import { tokenizeForIndexing, tokenizeForSearch } from "./tokenizer.ts";
import { getGroups, removeDiacritics, removeStrayDiacritics, stripMarkdownCharacters, trackPromiseProgress } from "./utils.ts";
import { CompleteEntry, IndexableEntry, RecencyCutoff } from "./global.ts";
import { getMatches, makeExcerpt } from "./textprocessing.ts";
import { ResultExcerpt, ResultPage } from "../../shared/global.ts";
import { getNameFromPath, isMarkdownPath, Path } from "@silverbulletmd/silverbullet/lib/ref";
import { fileName, folderName } from "@silverbulletmd/silverbullet/lib/resolve";
import { extractContentByPath } from "./extract.ts";

const cacheVersion = 2;

export class SearchEngine {
    private minisearch: MiniSearch;
    private entryCache: Map<string, CompleteEntry>;

    constructor(settings: SilversearchSettings) {
        this.minisearch = new MiniSearch(SearchEngine.getOptions(settings));
        this.entryCache = new Map();
    }

    public static async loadFromCache(settings: SilversearchSettings): Promise<SearchEngine | null> {
        const cache = await clientStore.get("silversearch-cache");

        if (!cache || cache.version !== cacheVersion || typeof (cache.minisearch) !== "string") {
            console.log("[Silversearch] Couldn't find cache or cache version mismatched");
            SearchEngine.deleteCache();

            return null;
        }

        const searchEngine = new SearchEngine(settings);

        searchEngine.minisearch = await MiniSearch.loadJSONAsync(cache.minisearch, SearchEngine.getOptions(settings));

        return searchEngine;
    }

    public static async deleteCache() {
        await clientStore.del("silversearch-cache");
    }

    public async writeToCache(): Promise<void> {
        await clientStore.set("silversearch-cache", {
            version: cacheVersion,
            minisearch: JSON.stringify(this.minisearch),
        });
    }

    public async reindex(): Promise<void> {
        await editor.flashNotification("Silversearch - Fully reindexing, this can cause performance problems");
        this.minisearch.removeAll();

        // We could also use listDocuments and listPages, overhead is probably
        // similar tho, but we would have to filter stuff like plugs ourselfs
        const files = (await space.listFiles())
            .map(file => file.name as Path)
            .filter(this.isIndexedPath);

        console.log(`[Silversearch] Indexing ${files.length} pages`);
        await editor.showProgress(0, "index");

        const entries = await trackPromiseProgress(
            files.map(file => SearchEngine.pathToIndexableEntry(file)),
            (done, all) => {
                // Don't await, we don't care
                editor.showProgress(Math.round(done / all * 100), "index");
            }
        );

        await this.minisearch.addAllAsync(entries.filter(entry => !!entry));

        await this.writeToCache();

        await editor.showProgress();
        await editor.flashNotification("Silversearch - Full reindex done!");
    }

    public async indexByPath(path: Path): Promise<void> {
        await this.indexByPaths([path]);
    }

    public async indexByPaths(paths: Path[]): Promise<void> {
        for (const path of paths) {
            try {
                console.log(`[Silversearch] Indexing ${getNameFromPath(path)}`);

                const entry = await SearchEngine.pathToIndexableEntry(path);
                if (!entry) throw null;

                if (this.minisearch.has(entry.path)) this.minisearch.replace(entry);
                else this.minisearch.add(entry);
            } catch {
                console.log(`[Silversearch] Failed to index ${getNameFromPath(path)}. Skipping!`);
            }
        }

        await this.writeToCache();
    }

    public async deleteByPath(path: Path): Promise<void> {
        await this.deleteByPaths([path]);
    }

    public async deleteByPaths(paths: Path[]): Promise<void> {
        for (const path of paths) {
            if (!(await space.fileExists(path))) {
                // Silverbullet probably fucked up here, let's just ignore it
                continue;
            }

            try {
                this.minisearch.discard(path);
            } catch {
                console.log("[Silversearch] Something went wrong. Failed to delete page")
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
        const documents = (await Promise.all(
            results.map(async result => await this.getCompleteEntry(result.id))
        )).filter((doc) => !!doc);

        // Extract tags from the query
        const tags = query.getTags();

        for (const result of results) {
            const path = result.id;
            const name = getNameFromPath(path);
            if (settings.downrankedFoldersFilters.length > 0) {
                // downrank files that are in folders listed in the downrankedFoldersFilters
                const downrankingFolder =
                    // Check that it matches a whole folder name, so we don't get partial matches
                    settings.downrankedFoldersFilters.some(filter => name === filter || name.startsWith(filter + '/')) ||
                    name.split('/').some(part => settings.downrankedFoldersFilters.includes(part));

                if (downrankingFolder) result.score /= 10;
            }


            const metadata = documents.find((d) => d.path === path)?.metadata;
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
                const document = documents.find(d => d.path === r.id);
                const title = document?.name.toLowerCase() ?? "";
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
                    documents.find(d => d.path === r.id)?.content ?? ""
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

        const documents = (await Promise.all(
            results.map(async result => await this.getCompleteEntry(result.id))
        )).filter((doc) => !!doc);

        // Map the raw results to get usable suggestions
        const resultNotes = await Promise.all(results.map(async result => {
            const note = documents.find(d => d.path === result.id)
            if (!note) {
                console.warn(`[Silversearch] Note "${result.name}" disappeared. Skipping`);
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
                note.name,
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

    private async getCompleteEntry(path: Path): Promise<CompleteEntry | null> {
        let meta: PageMeta | DocumentMeta;

        try {
            const name = getNameFromPath(path);

            meta = isMarkdownPath(path)
                ? await space.getPageMeta(name)
                : await space.getDocumentMeta(name);
        } catch {
            console.log("[Silversearch] Couldn't find the specified page:", path);

            return null;
        }

        const cached = this.entryCache.get(path);
        if (cached && new Date(meta.lastModified).getTime() === cached.lastModified) return cached;

        const result = await SearchEngine.pathToIndexableEntry(path, meta);
        if (!result) return null;

        // TODO: This is cursed, move this out of here
        const metadata = Object.fromEntries(Object.entries(meta).filter(([key, _]) => !["ref", "tag", "tags", "itags", "name", "created", "lastModified", "perm", "lastOpened", "pageDecoration", "aliases", "extension", "size", "contentType"].includes(key)));

        const entry = {
            ...result,
            cleanedContent: stripMarkdownCharacters(removeDiacritics(result.content)),
            metadata
        }

        this.entryCache.set(path, entry);

        return entry;
    }

    private static async pathToIndexableEntry(path: Path, cachedMeta?: PageMeta | DocumentMeta): Promise<IndexableEntry | null> {
        const name = getNameFromPath(path);

        let meta;
        try {
            meta = cachedMeta ?? (isMarkdownPath(path) ? await space.getPageMeta(name) : await space.getDocumentMeta(name));
        } catch {
            return null;
        }

        let content = await extractContentByPath(path, meta);
        if (!content) {
            return null;
        }

        // Remove any stray diatrics. Not doing this could cause problems
        // later when removing diatrics in e.g. `getMatches`, because the
        // offsets won't match between the cleaned string and the original
        // string
        content = removeStrayDiacritics(content);

        const entry: IndexableEntry = {
            path,
            name,
            content,
            aliases: meta.aliases ?? [],
            displayName: meta.displayName ?? "",
            basename: fileName(name),
            directory: folderName(name),
            tags: meta.tags?.map((tag) => "#" + tag) ?? [],
            unmarkedTags: meta.tags ?? [],
            lastModified: new Date(meta.lastModified).getTime(),
        };

        return entry;
    }

    private isIndexedPath(path: Path) {
        return !path.startsWith("_plug/");
    }

    private static getOptions(settings: SilversearchSettings): Options<IndexableEntry> {
        return {
            tokenize: (text: string) => tokenizeForIndexing(text, { tokenizeUrls: settings.tokenizeUrls }),
            processTerm: (term: string) => (settings.ignoreDiacritics
                ? removeDiacritics(term, settings.ignoreArabicDiacritics)
                : term
            ).toLowerCase(),
            idField: "path",
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