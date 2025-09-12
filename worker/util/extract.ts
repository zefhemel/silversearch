import { getNameFromPath, isMarkdownPath, Path } from "@silverbulletmd/silverbullet/lib/ref";
import { space, events } from "@silverbulletmd/silverbullet/syscalls";
import { DocumentMeta, PageMeta } from "@silverbulletmd/silverbullet/type/index";

// Maybe we want to add some stuff in the future
type ExtractionResult = {
    content: string;
}

function isExtractionResult(input: unknown): input is ExtractionResult {
    return !!input && typeof input === "object" && "content" in input && typeof input.content === "string";
}

export async function extractContentByPath(path: Path, cachedMeta?: PageMeta | DocumentMeta): Promise<string | null> {
    if (isMarkdownPath(path)) {
        try {
            return await space.readPage(getNameFromPath(path));
        } catch {
            return null;
        }
    } else {
        let meta;
        try {
            meta = cachedMeta ?? await space.getDocumentMeta(getNameFromPath(path));
        } catch {
            return null;
        }

        let results;
        try {
            results = await events.dispatchEvent("silversearch:index", { meta }) as unknown[];
        } catch {
            console.log(`[silversearch] Eventhandler threw errors. Discarding it.`)
            return null;
        }

        if (results.length === 0) return null;
        else if (results.length > 1) {
            console.log(`[silversearch] We got multiple responses while indexing ${meta.name}. Can't handle that.`);
        }

        const result = results[0];
        if (!isExtractionResult(result)) {
            console.log(`[silversearch] Eventhandler didn't return well-formed result. Discarding it.`)
            return null;
        }

        return result.content;
    }
}
