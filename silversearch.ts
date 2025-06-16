import * as editor from "$sb/syscalls/editor.ts"

import script from "./dist/modal.iife.js.ts"
import html from "./dist/modal.html.ts"

export async function openSearch(): Promise<void> {
    // TODO: Unfocus editor here

    await editor.showPanel(
        "modal",
        // We can't have a falsy value (0) here, because of some silverbullet oddities
        1,
        html,
        script,
    );
}