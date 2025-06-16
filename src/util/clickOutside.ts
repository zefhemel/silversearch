import { Action } from "svelte/action";

export const clickOutside: Action<any, undefined, { onoutsideclick: (e: CustomEvent) => void; }> = (node) => {
    const handleClick = (event: MouseEvent) => {
        if (node && !node.contains(event.target as HTMLElement) && !event.defaultPrevented) {
            node.dispatchEvent(new CustomEvent('outsideclick'));
        }
    }

    document.addEventListener('click', handleClick, true);

    return {
        destroy() {
            document.removeEventListener('click', handleClick, true);
        }
    }
}