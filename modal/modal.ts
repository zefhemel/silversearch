import "./modal.css"
import { mount } from "svelte"
import Modal from "./components/Modal.svelte"

async function mountModal() {
    const page: Promise<string> = syscall("editor.getCurrentPage");
    const isDocumentEditor: Promise<string> = syscall("editor.getCurrentEditor");

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
            isDocumentEditor: (await isDocumentEditor) !== "page",
        }
    });
}

mountModal();