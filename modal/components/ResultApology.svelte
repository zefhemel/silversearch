<script lang="ts">
    const { type }: { type: "no-results" | "searching" } = $props();
</script>

<div class="silversearch-apology">
{#if type === "no-results"}
Silversearch found <code>0</code> results for your query
{:else if type === "searching"}
Searching...
{/if}
</div>

<style>
    .silversearch-apology {
        text-align: center;
        padding: 5px;
    }
</style>