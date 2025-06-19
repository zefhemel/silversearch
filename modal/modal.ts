import "./modal.css"
import { mount } from "svelte"
import Modal from "./components/Modal.svelte"

function mountModal() {
    mount(Modal, {
        target: document.querySelector("#container")!
    });
}

// TODO
// Be careful with the timings here
// See Treeview Plug for reference
// const customStyles = await getCustomStyles();

mountModal();