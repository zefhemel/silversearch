<script lang="ts">
    import { clickOutside } from "./util/clickOutside";

    let dialog: HTMLDialogElement;

    $effect(() => {
        dialog.showModal();
    })

</script>


<dialog
    style="outline: none;"
    bind:this={dialog}
    class="sb-modal-box"
    onclose={(e: Event) => {
        e.preventDefault();
        syscall("editor.hidePanel", "modal");
    }}
    use:clickOutside
    onoutsideclick={() => {
        syscall("editor.hidePanel", "modal");
    }}
    onkeydown={(e) => {
        e.stopPropagation();
    }}
>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="sb-header"
        onclick={(e: Event) => e.stopPropagation()}
    >
        <label>Search</label>
        <div class="sb-mini-editor">Editor Placeholder</div>
    </div>
    <h1>Hallo das ist ein Test</h1>
</dialog>