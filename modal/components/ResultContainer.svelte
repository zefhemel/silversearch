<script lang="ts">
    import type { Snippet } from "svelte";
    import type { MouseEventHandler } from "svelte/elements";

    const {
        title,
        description,
        info,
        selected,
        onclick,
        onmousemove,
    }: {
        title?: Snippet;
        description: Snippet;
        info?: Snippet;
        selected: boolean;
        onclick: MouseEventHandler<HTMLDivElement>;
        onmousemove: MouseEventHandler<HTMLDivElement>;
    } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="sb-option"
    class:silversearch-selected={selected}
    {onclick}
    {onmousemove}
>
    {#if title || info}
        <div class="sb-name">
            {#if title}
                <span class="silversearch-title">{@render title()}</span>
            {/if}
            {#if info}
                <span class="silversearch-info">{@render info()}</span>
            {/if}
        </div>
    {/if}
    <div class="sb-description">
        {@render description()}
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

    .silversearch-info {
        font-size: 0.8rem;
        margin-left: 1ch;
        color: var(--modal-description-color);
    }

    .silversearch-title {
        text-overflow: ellipsis;
        overflow: hidden;
    }

    :global(.silversearch-selected) {
        background-color: var(--editor-selection-background-color);
    }
</style>
