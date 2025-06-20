<script lang="ts">
    import type { ResultNote } from "../../shared/global.ts";
    import { debounce } from "../util/debounce.ts";
    import Result from "./Result.svelte";
    import { tick } from "svelte";

    let dialog: HTMLDialogElement;

    let query: string = $state("");

    let results: ResultNote[] = $state([]);
    let searching = $state(false);

    let selectedIndex: number = $state(0);

    // We can't use the `open` property on the dialog, because then some events don't fire
    $effect(() => {
        dialog.showModal();
    });

    $effect(() => {
        if (query) {
            debounceUpdateResults();
        } else {
            results = [];
            searching = false;
        }
    });

    const debounceUpdateResults = debounce(updateResults, 0)

    // svelte-ignore non_reactive_update
    let waitPromise: PromiseWithResolvers<ResultNote[]> | null = null;
    async function updateResults() {
        searching = true;

        if (waitPromise) {
            waitPromise.reject("canceled");
            waitPromise = null;
        }

        waitPromise = Promise.withResolvers();

        try {
            results = await Promise.race([syscall("silversearch.search", query) as Promise<ResultNote[]>, waitPromise.promise]);
            waitPromise = null;
            selectedIndex = 0;
            scrollIntoView();
            searching = false;
        } catch (_) {}
    }

    function onClickWindow() {
        syscall("editor.hidePanel", "modal");
    }

    function openSelected(openInNewTab: boolean) {
        const result = results[selectedIndex];
        const offset = result.matches?.[0]?.offset ?? 0

        syscall("editor.navigate", {
            kind: "page",
            page: result.ref,
            pos: offset,
        }, false, openInNewTab);

        syscall("editor.hidePanel", "modal");
    }

    function onKeyDown(e: KeyboardEvent) {
        // TODO: Silverbullet supports quiete a few more here
        if (e.key === "ArrowUp") selectedIndex--;
        else if (e.key === "ArrowDown") selectedIndex++;
        else if (e.key === "Enter") {
            openSelected(e.ctrlKey);
        }
        else return;

        e.preventDefault();

        selectedIndex = Math.max(0, Math.min(results.length - 1, selectedIndex));

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


<svelte:window onclick={onClickWindow}/>
<dialog
    class="sb-modal-box"
    oncancel={(e: Event) => {
        e.preventDefault();
        syscall("editor.hidePanel", "modal");
    }}
    onkeydown={(e) => {
        e.stopPropagation();
    }}
    bind:this={dialog}
>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="sb-header"
        onclick={(e: Event) => e.stopPropagation()}
        onkeydown={onKeyDown}
    >
        <label for="mini-editor">Search</label>
        <div class="sb-mini-editor">
            <input id="mini-editor" placeholder="Search with Silversearch" bind:value={query}/>
        </div>
    </div>


    <div class="sb-result-list" style="max-height: 80vh;">
        {#each results as result, i}
            {@const isSelected = i === selectedIndex}
            <Result result={result} selected={isSelected} onclick={({ctrlKey}) => openSelected(ctrlKey)} onmousemove={() => selectedIndex = i}></Result>
        {/each}

        {#if !results.length && !searching && query}
            <p class="silversearch-apology">Silversearch found 0 results for your query</p>
        {:else if !results.length && !searching}
            <p class="silversearch-apology">Start typing to search with Silversearch</p>
        {:else if !results.length && searching}
            <!-- TODO: Think about this a little more indepth, maybe we should give somekind of feedback when loading -->
            <p class="silversearch-apology">Laoding...</p>
        {/if}
    </div>
</dialog>

<style>
    dialog {
        outline: none;
    }

    .silversearch-apology {
        text-align: center;
    }

    #mini-editor {
	    caret-color: white;
        outline: none;
        border: none;
        padding: 2px 0 0 3px;
        line-height: 1.4;
        width: 100%;
        background: none;
        font-family: var(--ui-font);
        font-size: 1em;
        color: inherit;
    }
</style>