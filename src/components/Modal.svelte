<script lang="ts">
    let dialog: HTMLDialogElement;
        
    // We can't use the `open` property on the dialog, because then some events don't fire
    $effect(() => {
        dialog.showModal();
    });

    // This is not the best, but replicates silverbullets behaviour
    $effect(() => {
        function onclick() {
            syscall("editor.hidePanel", "modal");
        }

        document.addEventListener("click", onclick);

        return () => {
            document.removeEventListener("click", onclick);
        }
    });
</script>


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
    >
        <label for="mini-editor">Search</label>
        <div class="sb-mini-editor">
            <input id="mini-editor" placeholder="Search with Silversearch"/>
        </div>
    </div>
    
</dialog>

<style>
    dialog {
        outline: none;
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