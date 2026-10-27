/** Internal conversation DOM seams, validated by the pinned host journeys.
 * Main message markers and composer seats have no public replacement API. */
export declare const MAIN_ASSISTANT = "[data-chat-flow-kind=\"assistant-step\"]";
export declare const NON_QUOTE = "button, [role=\"button\"], input, textarea, select, [contenteditable=\"true\"], [data-code-block-banner], [data-variant=\"think\"], [data-sidenote-no-quote]";
export declare function nativeAssistantBodies(root?: ParentNode): HTMLElement[];
export declare function elementOf(node: Node): Element | null;
export declare function mainMessageOf(node: Node, currentSessionId: string): {
    body: HTMLElement;
    view: HTMLElement;
    anchor: HTMLElement;
    key: string | undefined;
    sessionId: string;
    surface: "main";
    streaming: boolean;
} | null;
export declare function mainAnchorBodies(sessionId: string, anchorKey: string, currentSessionId: string): HTMLElement[];
/** Intersect every clipping ancestor, then exclude this view's composer. */
export declare function quoteClipOf(body: HTMLElement, view: HTMLElement): {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
export declare function mainComposerOf(node: Element): HTMLElement | null;
export declare function focusMainComposer(view: HTMLElement): void;
export declare function focusSideComposer(view: HTMLElement): void;
/** 主 composer 的宿主容器（侧边面板 textarea 不在其中，天然不串）。 */
export declare function composerSeat(): HTMLElement | null;
/** 发送按钮 = [data-composer-card] 内 DOM 序最后一个 button（仅 click 路径用，
 *  且只在非运行态作为识别面——运行态主按钮变身「停止」，整个 click 路径不拦）。 */
export declare function findSendButtonInCard(root?: ParentNode): HTMLButtonElement | null;
export declare function composerSessionId(seat: HTMLElement, fallback: string): string;
/** Bound message hover details to their native conversation pane. */
export declare function conversationViewOf(node: Element): HTMLElement;
/** Find the last rendered member of an explicit history range, not the side-chat tail. */
export declare function lastConversationEntry(root: HTMLElement, keys: ReadonlySet<string>): HTMLElement | undefined;
/** Land above the native composer, without scrolling another pane or moving focus. */
export declare function revealConversationEntryEnd(row: HTMLElement): void;
export declare function isMainComposerInput(target: EventTarget | null): boolean;
export declare function composerHasMenu(seat: HTMLElement): boolean;
export declare function hasConversationMessages(): boolean;
/** 0.2.0 has no UserText extension. Only add our own portal seat; never move
 * or replace host-owned children. The CSS-module suffix is checked by E2E. */
export declare function mountUserBubbleAddon(root: HTMLElement, addon: HTMLElement): () => void;
