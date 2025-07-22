import { editor, syscall } from "@silverbulletmd/silverbullet/syscalls";
import { IndexTreeEvent } from "@silverbulletmd/silverbullet/type/event";

import script from "../dist/modal.iife.js.ts"
import html from "../dist/modal.html.ts"

import { SearchEngine } from "./util/searchengine.ts";
import { Query } from "./util/query.ts";
import { getCustomStyles, getPlugConfig } from "./util/settings.ts";
import { ResultPage } from "../shared/global.ts";
import { publicVersion } from "../dist/public_verion.ts";

// So this will be a global variable in a service worker, so the lifetime is kind of uncertain, especially if
// we don't have direct access to events, i.e. we can't trust that this exists AT ALL
let searchEngine: SearchEngine | null = null;

type Action = {
    action: "delete" | "index",
    ref: string
}

let actionQueue: Action[] = [];

async function checkIfInitalized() {
    if (searchEngine) return;

    const settings = await getPlugConfig();
    searchEngine = new SearchEngine(settings);

    // We want to try to load from cache, if that fails create the index and cache it
    const cacheExists = await searchEngine.loadFromCache(settings);

    if (!cacheExists) {
        await searchEngine.fullReindex();
    } else if (actionQueue.length) {
        await searchEngine.indexPages(actionQueue.filter((action) => action.action === "index").map((action) => action.ref));
        await searchEngine.deletePages(actionQueue.filter((action) => action.action === "delete").map((action) => action.ref));
        actionQueue = [];
    }
}

export async function openSearch(defaultQuery: string  = ""): Promise<void> {
    const styles = await getCustomStyles();

    await editor.showPanel(
        "modal",
        // We can't have a falsy value (0) here, because of some silverbullet oddities
        1,
        styles ? `<style>${styles}</style>` + html : html,
        defaultQuery ? `globalThis.DEFAULT_QUERY = "${defaultQuery}";` + script : script,
    );
}

export async function startSearch(): Promise<void> {
    await syscall("silversearch.openSearch");
}

export async function init(): Promise<void> {
    // Just to be sure
    await checkIfInitalized();
}

export async function index({ name }: IndexTreeEvent) {
    // We piggyback of the index event here as that pretty much excatly aligns with our needs.
    if (!searchEngine) actionQueue.push({ action: "index", ref: name });
    else await searchEngine.indexPage(name);
}

export async function deleted(name: string) {
    if (!searchEngine) actionQueue.push({ action: "delete", ref: name });
    else await searchEngine.deletePage(name);
}

export async function search(searchTerm: string, singleFilePath?: string): Promise<ResultPage[]> {
    await checkIfInitalized();

    const settings = await getPlugConfig();

    const query = new Query(searchTerm, {
      ignoreDiacritics: settings.ignoreDiacritics,
      ignoreArabicDiacritics: settings.ignoreArabicDiacritics,
    });

    return searchEngine!.getSuggestions(query, { singleFilePath });
}

export async function reindex() {
    await SearchEngine.deleteCache();
    searchEngine = null;

    await checkIfInitalized();
}

export async function showVersion() {
    await editor.flashNotification(`Silversearch - Version ${publicVersion}`);
}