// Modo demonstração: embaralha valores monetários só no DOM. Estado, cache e banco nunca são tocados.
// ponytail: atua sobre texto renderizado; gráficos em <canvas> (Chart.js) não são embaralhados.

const STORAGE_KEY = "prism.demo-mode";
const MONEY_PATTERN = /R\$\s*-?\d[\d.,]*|\d[\d.]*,\d{2}(?!\d)/g;
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA"]);

const originals = new WeakMap<Text, string>();
const scrambled = new WeakMap<Text, string>();
const touched = new Set<Text>();
let observer: MutationObserver | null = null;

function hash(value: string): number {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        result = Math.imul(result ^ value.charCodeAt(index), 16777619);
    }
    return result >>> 0;
}

function scrambleDigits(match: string): string {
    let seed = hash(match);
    let isLeading = true;
    return match.replace(/\d/g, (digit) => {
        seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
        const next = isLeading && digit !== "0" ? 1 + (seed % 9) : seed % 10;
        isLeading = false;
        return String(next);
    });
}

/** Troca cada dígito de forma determinística (o mesmo valor vira sempre o mesmo número falso). */
export function scrambleMoneyText(text: string, previousText = ""): string {
    // JSX como `R$ {valor}` gera dois nós de texto: o número chega sozinho, logo após o "R$".
    if (/R\$\s*$/.test(previousText) && /^\s*-?\d[\d.,]*\s*$/.test(text)) {
        return scrambleDigits(text);
    }
    return text.replace(MONEY_PATTERN, scrambleDigits);
}

function scrambleNode(node: Text) {
    const current = node.nodeValue ?? "";
    if (current === scrambled.get(node) || (node.parentElement && SKIPPED_TAGS.has(node.parentElement.tagName))) {
        return;
    }

    const next = scrambleMoneyText(current, node.previousSibling instanceof Text ? (originals.get(node.previousSibling) ?? node.previousSibling.nodeValue ?? "") : "");
    if (next === current) {
        return;
    }

    originals.set(node, current);
    scrambled.set(node, next);
    touched.add(node);
    node.nodeValue = next;
}

function scrambleTree(root: Node) {
    if (root instanceof Text) {
        scrambleNode(root);
        return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        scrambleNode(node as Text);
    }
}

function start() {
    if (observer) return;
    scrambleTree(document.body);
    observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === "characterData") scrambleTree(mutation.target);
            mutation.addedNodes.forEach(scrambleTree);
        }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

function stop() {
    observer?.disconnect();
    observer = null;
    touched.forEach((node) => {
        if (node.isConnected && node.nodeValue === scrambled.get(node)) {
            node.nodeValue = originals.get(node) ?? node.nodeValue;
        }
        scrambled.delete(node);
    });
    touched.clear();
}

export function isDemoModeEnabled(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
        return false;
    }
}

export function setDemoModeEnabled(enabled: boolean) {
    try {
        window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
        // Sem storage o modo vale só para esta aba.
    }
    if (enabled) start();
    else stop();
}

export function initDemoMode() {
    if (isDemoModeEnabled()) start();
}
