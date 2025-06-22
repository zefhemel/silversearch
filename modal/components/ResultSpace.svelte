<script lang="ts">
    import type { ResultPage } from "../../shared/global";
    import { highlightText } from "../util/highlighting";
    import ResultContainer from "./ResultContainer.svelte";

    const {
        result,
        selected,
        onclick,
        onmousemove,
    }: {
        result: ResultPage;
        selected: boolean;
        onclick: (e: MouseEvent) => void;
        onmousemove: (e: MouseEvent) => void;
    } = $props();
</script>

<ResultContainer {onmousemove} {onclick} {selected}>
    {#snippet title()}
        {@html highlightText(result.ref, result.matchesName)}
    {/snippet}
    {#snippet info()}
        {result.matches.length} Matches
    {/snippet}
    {#snippet description()}
        {@html highlightText(result.excerpts[0].excerpt, result.matches)}
    {/snippet}
</ResultContainer>
