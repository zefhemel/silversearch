<script lang="ts">
    import type { ResultPage } from "../../shared/global";
    import { highlightText } from "../util/highlighting";

    const { result, selected, onclick, onmousemove }: { result: ResultPage, selected: boolean, onclick: (e: MouseEvent) => void, onmousemove: (e: MouseEvent) => void } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sb-option" class:silversearch-selected={selected} onclick={onclick} onmousemove={onmousemove}>
    <div class="sb-name">
        <span class="silversearch-title">{@html highlightText(result.ref, result.matchesName)}</span>
        <span class="silversearch-matches">{result.matches.length} Matches</span>
    </div>
    <div class="sb-description">
        {@html highlightText(result.excerpts[0].excerpt, result.matches)}
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

    .sb-name {
        display: flex;
        white-space: nowrap;
        align-items: baseline;
    }

    .silversearch-matches {
        font-size: 0.8rem;
        margin-left: 1ch;
        color: var(--modal-description-color)
    }

    .silversearch-title {
        text-overflow: ellipsis;
        overflow: hidden;
    }

    /* For whatever reason svelte has problems with conditional styles*/
    :global(.silversearch-selected) {
        background-color: var(--editor-selection-background-color);
    }
</style>