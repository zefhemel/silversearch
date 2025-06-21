import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { z } from "zod"
import { RecencyCutoff } from "./global.ts";

let errorWasShown = false;
let settings: null | SilversearchSettings = null;

const weightSchema = z.strictObject({
    content: z.optional(z.number()).default(1),
    basename: z.optional(z.number()).default(10),
    displayName: z.optional(z.number()).default(10),
    directory: z.optional(z.number()).default(7),
    aliases: z.optional(z.number()).default(1),
    tags: z.optional(z.number()).default(1),
});

const settingsSchema = z.strictObject({
    weights: z.optional(weightSchema).default(weightSchema.parse({})),
    weightCustomProperties: z.optional(z.array(z.strictObject({name: z.string(), weight: z.number()}))).default([]),
    recencyBoost: z.optional(z.enum(RecencyCutoff)).default(RecencyCutoff.Disabled),
    downrankedFoldersFilters: z.optional(z.array(z.string())).default([]),
    ignoreDiacritics: z.optional(z.boolean()).default(true),
    ignoreArabicDiacritics: z.optional(z.boolean()).default(false),
    tokenizeUrls: z.optional(z.boolean()).default(true),
    splitCamelCase: z.optional(z.boolean()).default(true),
    fuzziness: z.optional(z.enum(["0", "1", "2"])).default("1"),
    renderLineReturnInExcerpts: z.optional(z.boolean()).default(true),
});

export type SilversearchSettings = z.infer<typeof settingsSchema>

export async function getPlugConfig(): Promise<SilversearchSettings> {
    if (settings) return settings;

    const config = await system.getConfig("silversearch", {});

    const result = settingsSchema.safeParse(config);

    if (!result.success) {
        if (!errorWasShown) {
            await editor.flashNotification(`Silersearch - There was an error in your CONFIG: ${z.prettifyError(result.error)}`);

            errorWasShown = true;
        }

        settings = settingsSchema.parse({});
    } else {
        settings = result.data;
    }

    return settings;
}

export async function getCustomStyles(): Promise<string | undefined> {
    return await editor.getUiOption("customStyles");
}