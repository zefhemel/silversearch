import "./modal.css"
import { mount } from "svelte"
import Modal from "./components/Modal.svelte"

async function mountModal() {
    const page = syscall("editor.getCurrentPage");

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
        props: {
            defaultQuery: globalThis.DEFAULT_QUERY ?? "",
            currentPage: await page,
        }
    });
}

mountModal();