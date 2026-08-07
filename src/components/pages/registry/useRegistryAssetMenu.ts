import { useCallback, useState } from "react";
import type { RegistryAssetMenuState } from "./registryAssetTypes";

export function useRegistryAssetMenu() {
    const [menuState, setMenuState] = useState<RegistryAssetMenuState | null>(null);

    const openMenu = useCallback((assetId: string, x: number, y: number) => {
        setMenuState({ assetId, x, y });
    }, []);

    const closeMenu = useCallback(() => setMenuState(null), []);

    return { menuState, openMenu, closeMenu };
}
