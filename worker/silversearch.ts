import { editor, syscall } from "@silverbulletmd/silverbullet/syscalls";
import { IndexTreeEvent } from "@silverbulletmd/silverbullet/type/event";

import script from "../dist/modal.iife.js.ts"
import html from "../dist/modal.html.ts"

import { SearchEngine } from "./util/searchengine.ts";
import { Query } from "./util/query.ts";
import { getPlugConfig } from "./util/settings.ts";
import { ResultNote } from "../shared/global.ts";

// So this will be a global variable in a service worker, so the lifetime is kind of uncertain, especially if
// we don't have direct access to events, i.e. we can't trust that this exists AT ALL
let searchEngine: SearchEngine | null = null;

let indexQueue: string[] = [];

// TODO: Handle multiple calls of this
async function checkIfInitalized() {
    if (searchEngine) return;

    const settings = await getPlugConfig();
    searchEngine = new SearchEngine(settings);

    // We want to try to load from cache, if that fails create the index and cache it
    const cacheExists = await searchEngine.loadFromCache(settings);

    if (!cacheExists) {
        await searchEngine.fullReindex();
    } else if (indexQueue.length) {
        await searchEngine.indexPages(indexQueue);
        indexQueue = [];
    }
}

export async function openSearch(): Promise<void> {
    await editor.showPanel(
        "modal",
        // We can't have a falsy value (0) here, because of some silverbullet oddities
        1,
        html,
        script,
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
    if (!searchEngine) indexQueue.push(name);
    else await searchEngine.indexPage(name);
}

export async function search(searchTerm: string): Promise<ResultNote[]> {
    await checkIfInitalized();

    const settings = await getPlugConfig();

    const query = new Query(searchTerm, {
      ignoreDiacritics: settings.ignoreDiacritics,
      ignoreArabicDiacritics: settings.ignoreArabicDiacritics,
    });

    return searchEngine!.getSuggestions(query);
}

export async function reindex() {
    await SearchEngine.deleteCache();
    searchEngine = null;

    await checkIfInitalized();
}