import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface AnchoredOverlayPosition {
    bottom?: number;
    left: number;
    maxHeight: number;
    top?: number;
    width: number;
}

interface AnchoredOverlayProps<T extends HTMLElement> {
    anchorRef: RefObject<T | null>;
    children: ReactNode;
    className?: string;
    isOpen: boolean;
    overlayRef: RefObject<HTMLDivElement | null>;
    preferredMaxHeight?: number;
    /** Largura fixa do overlay, independente da largura do elemento-gatilho (ex.: gatilho pequeno abrindo um popover maior). */
    overlayWidth?: number;
    /** Alinhamento horizontal do overlay em relação ao gatilho quando `overlayWidth` é usado. */
    align?: "start" | "center" | "end";
}

const VIEWPORT_PADDING = 12;
const OVERLAY_GAP = 6;

export function AnchoredOverlay<T extends HTMLElement>({
    anchorRef,
    children,
    className = "",
    isOpen,
    overlayRef,
    preferredMaxHeight = 360,
    overlayWidth,
    align = "start",
}: AnchoredOverlayProps<T>) {
    const [position, setPosition] = useState<AnchoredOverlayPosition | null>(null);

    useLayoutEffect(() => {
        if (!isOpen) {
            setPosition(null);
            return;
        }

        const updatePosition = () => {
            const anchor = anchorRef.current;
            if (!anchor) {
                return;
            }

            const anchorRect = anchor.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const availableBelow = Math.max(0, viewportHeight - anchorRect.bottom - OVERLAY_GAP - VIEWPORT_PADDING);
            const availableAbove = Math.max(0, anchorRect.top - OVERLAY_GAP - VIEWPORT_PADDING);
            const minimumComfortableHeight = Math.min(220, preferredMaxHeight);
            const placeBelow = availableBelow >= minimumComfortableHeight || availableBelow >= availableAbove;
            const availableHeight = placeBelow ? availableBelow : availableAbove;
            const width = Math.min(overlayWidth ?? anchorRect.width, viewportWidth - VIEWPORT_PADDING * 2);
            const anchorLeft = align === "end" ? anchorRect.right - width : align === "center" ? anchorRect.left + anchorRect.width / 2 - width / 2 : anchorRect.left;
            const left = Math.min(
                Math.max(VIEWPORT_PADDING, anchorLeft),
                Math.max(VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING),
            );

            setPosition({
                left,
                width,
                maxHeight: Math.max(96, Math.min(preferredMaxHeight, availableHeight)),
                ...(placeBelow
                    ? { top: anchorRect.bottom + OVERLAY_GAP }
                    : { bottom: viewportHeight - anchorRect.top + OVERLAY_GAP }),
            });
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        const resizeObserver = new ResizeObserver(updatePosition);
        if (anchorRef.current) {
            resizeObserver.observe(anchorRef.current);
        }

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [anchorRef, isOpen, preferredMaxHeight, overlayWidth, align]);

    if (!isOpen) {
        return null;
    }

    const style: CSSProperties = position
        ? {
              bottom: position.bottom,
              left: position.left,
              maxHeight: position.maxHeight,
              top: position.top,
              width: position.width,
          }
        : { visibility: "hidden" };

    return createPortal(
        <div
            ref={overlayRef}
            data-modal-overlay-root="true"
            className={`fixed z-[220] overflow-y-auto ${className}`.trim()}
            style={style}
        >
            {children}
        </div>,
        document.body,
    );
}
