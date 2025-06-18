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
// const customStyles = await getCustomStyles();

console.log("Value:", document.getElementsByTagName("html")[0].attributes.getNamedItem("data-theme")?.value);

mountModal();