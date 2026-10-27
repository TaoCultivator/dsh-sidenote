import type { Context, SessionListSnapshot } from './contracts.ts';
/** Browser-local identity outlives tabs and the capped recent-closed menu. */
export declare function createSessionVisibility(): {
    getSnapshot: () => {
        hidden: ReadonlySet<string>;
        pending: readonly ReadonlySet<string>[];
        show: boolean;
        saved: boolean;
    };
    subscribe(fn: () => void): () => void;
    hide(...ids: string[]): void;
    setShow(show: boolean): void;
    watch(): () => void;
    /** Start before fork/create: host list events may precede the RPC response. */
    begin(list: SessionListSnapshot): () => void;
};
export type SessionVisibility = ReturnType<typeof createSessionVisibility>;
type VisibilitySnapshot = ReturnType<SessionVisibility['getSnapshot']>;
/** Filter only the WorkspaceBrowser's input; bindings and global stores stay intact. */
export declare function visibleSessionList<T>(list: T, visibility: VisibilitySnapshot): T;
export declare function sessionVisibilityOf(ctx: Context): SessionVisibility;
export {};
