<script lang="ts">
    import type { MouseEventHandler } from "svelte/elements";
    import type { ResultExcerpt, SearchMatch } from "../../shared/global";
    import { highlightText } from "../util/highlighting";
    import ResultContainer from "./ResultContainer.svelte";

    const {
        excerpt,
        matches,
        selected,
        onclick,
        onmousemove,
    }: {
        excerpt: ResultExcerpt;
        matches: SearchMatch[];
        selected: boolean;
        onclick: MouseEventHandler<HTMLDivElement>;
        onmousemove: MouseEventHandler<HTMLDivElement>;
    } = $props();
</script>

<ResultContainer {onclick} {onmousemove} {selected}>
    {#snippet description()}
        {@html highlightText(excerpt.excerpt, matches)}
    {/snippet}
</ResultContainer>
