import { NavigationMap } from "../../shared/global";

export function solveNavigationMap(map: NavigationMap, offset: number): string {
    for (const route of map) {
        if (route.type === "range") {
            if (route.from <= offset && offset <= route.to) {
                return route.tail;
            }
        }
    }

    // If we can't solve the navigation map we will not try to navigate more specifically
    return "";
}