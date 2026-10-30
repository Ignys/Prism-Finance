import { useSyncExternalStore } from "react";

// Phones: narrow viewport with a touch-first pointer. Tablets/desktops keep the regular layout.
const QUERY = "(max-width: 767px) and (pointer: coarse)";

function subscribe(onChange: () => void) {
    const media = window.matchMedia(QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

export function useIsMobile() {
    return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
