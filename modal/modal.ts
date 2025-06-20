import "./modal.css"
import { mount } from "svelte"
import Modal from "./components/Modal.svelte"

async function mountModal() {
    await Promise.race([
        new Promise((resolve) => setTimeout(resolve, 75)),
        new Promise((resolve) => {
            const element = document.querySelector("link#stylesheet");

            if (!element) return;

            (element as HTMLLinkElement).onload = resolve;

        })
    ]);

    mount(Modal, {
        target: document.querySelector("#container")!,
        props: { defaultQuery: globalThis.DEFAULT_QUERY ?? "" }
    });
}

// TODO
// Be careful with the timings here
// See Treeview Plug for reference
// const customStyles = await getCustomStyles();

mountModal();