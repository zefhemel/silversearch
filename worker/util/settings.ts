import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
import * as v from "@valibot/valibot"
import { RecencyCutoff } from "./global.ts";

let errorWasShown = false;
let settings: null | SilversearchSettings = null;

const weightSchema = v.strictObject({
    content: v.optional(v.number(), 1),
    basename: v.optional(v.number(), 10),
    displayName: v.optional(v.number(), 10),
    directory: v.optional(v.number(), 7),
    aliases: v.optional(v.number(), 1),
    tags: v.optional(v.number(), 1),
});

const settingsSchema = v.strictObject({
    weights: v.optional(weightSchema, v.parse(weightSchema, {})),
    weightCustomProperties: v.optional(v.record(v.string(), v.number()), {}),
    recencyBoost: v.optional(v.enum(RecencyCutoff), RecencyCutoff.Disabled),
    downrankedFoldersFilters: v.optional(v.array(v.string()), []),
    ignoreDiacritics: v.optional(v.boolean(), true),
    ignoreArabicDiacritics: v.optional(v.boolean(), false),
    tokenizeUrls: v.optional(v.boolean(), true),
    splitCamelCase: v.optional(v.boolean(), true),
    fuzziness: v.optional(v.picklist(["0", "1", "2"]), "1"),
    renderLineReturnInExcerpts: v.optional(v.boolean(), true),
});

export type SilversearchSettings = v.InferOutput<typeof settingsSchema>

export async function getPlugConfig(): Promise<SilversearchSettings> {
    if (settings) return settings;

    const config = await system.getConfig("silversearch", {});

    const result = v.safeParse(settingsSchema, config);

    if (!result.success) {
        if (!errorWasShown) {
            const message = Object.entries(v.flatten<typeof settingsSchema>(result.issues).nested).reduce((acc, [location, err]) => `${acc}; ${err.join(" & ")} in "${location}"`, "").slice(1);

            await editor.flashNotification(`Silersearch - There was an error in your CONFIG: ${message}`);

            errorWasShown = true;
        }

        settings = v.parse(settingsSchema, {});
    } else {
        settings = result.output;
    }

    return settings;
}

export async function getCustomStyles(): Promise<string | undefined> {
    return await editor.getUiOption("customStyles");
}