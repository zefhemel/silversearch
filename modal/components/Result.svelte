<script lang="ts">
    import type { ResultNote } from "../../shared/global";
    import { highlightText } from "../util/highlighting";

    let { result, selected, onclick, onmousemove }: { result: ResultNote, selected: boolean, onclick: (e: MouseEvent) => void, onmousemove: (e: MouseEvent) => void } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sb-option" class:silversearch-selected={selected} onclick={onclick} onmousemove={onmousemove}>
    <div class="sb-name">
        {@html highlightText(result.ref, result.matchesName)}
    </div>
    <div class="sb-description">
        {@html highlightText(result.excerpt, result.matches)}
    </div>
</div>

<style>
    .sb-description {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        overflow: hidden;
    }

    /* For whatever reason svelte has problems with conditional styles*/
    :global(.silversearch-selected) {
        background-color: var(--editor-selection-background-color);
    }
</style>