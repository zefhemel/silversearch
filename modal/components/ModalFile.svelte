<script lang="ts">
    import { tick } from "svelte";
    import type { ResultPage } from "../../shared/global";
    import { debounce } from "../util/debounce";
    import ModalContainer from "./ModalContainer.svelte";
    import SearchTips from "./SearchTips.svelte";
    import ResultFile from "./ResultFile.svelte"

    let { query = $bindable(), currentPage }: { query: string, currentPage: string } = $props();

    let result: ResultPage | null = $state(null);
    let searching = $state(false);

    let selectedIndex: number = $state(0);

    $effect(() => {
        if (query) {
            debounceUpdateResults();
        } else {
            result = null;
            searching = false;
        }
    });

    const debounceUpdateResults = debounce(updateResults, 0)

    // svelte-ignore non_reactive_update
    let waitPromise: PromiseWithResolvers<ResultPage[]> | null = null;
    async function updateResults() {
        searching = true;

        if (waitPromise) {
            waitPromise.reject("canceled");
            waitPromise = null;
        }

        waitPromise = Promise.withResolvers();

        try {
            result = (await Promise.race([syscall("silversearch.search", query, currentPage) as Promise<ResultPage[]>, waitPromise.promise]))[0];
            waitPromise = null;
            selectedIndex = 0;
            scrollIntoView();
            searching = false;
        } catch (_) {}
    }

    async function openSelected(openInNewTab: boolean) {
        if (!result) return;
        const offset = result.excerpts[selectedIndex].offset;

        await syscall("editor.navigate", {
            kind: "page",
            page: result.ref,
            pos: offset,
        }, false, openInNewTab);

        await syscall("editor.hidePanel", "modal");
    }

    function onKeyDown(e: KeyboardEvent) {
        // TODO: Silverbullet supports quiete a few more here
        if (e.key === "ArrowUp") selectedIndex--;
        else if (e.key === "ArrowDown") selectedIndex++;
        else if (e.key === "Enter") openSelected(e.ctrlKey);
        else return;

        e.preventDefault();

        selectedIndex = Math.max(0, Math.min((result?.excerpts.length ?? 0) - 1, selectedIndex));

        scrollIntoView();
    }

    async function scrollIntoView() {
        await tick();

        const element = document.querySelector(".silversearch-selected");

        if (!element) return;

        element.scrollIntoView({
            block: "nearest",
        });
    }
</script>


<ModalContainer onkeydown={onKeyDown} bind:query>
    {#snippet helpText()}
        Press <code>Enter</code> to open the selected page, press <code>Ctrl-Enter</code> to open the page in a new Tab. Use <code>Tab</code> to search your space.
    {/snippet}

    {#snippet resultList()}
        {#each result?.excerpts ?? [] as excerpt, i}
            {@const isSelected = i === selectedIndex}
            <ResultFile excerpt={excerpt} matches={result?.matches ?? []} selected={isSelected} onclick={({ctrlKey}) => openSelected(ctrlKey)} onmousemove={() => selectedIndex = i}></ResultFile>
        {/each}

        {#if !result && !searching && query}
            <span class="silversearch-apology">Silversearch found <code>0</code> results for your query</span>
        {:else if !result && !searching}
            <SearchTips/>
        {:else if !result && searching}
            <span class="silversearch-apology">Searching...</span>
        {/if}
    {/snippet}
</ModalContainer>