import type { Context, SessionFace, SessionInput } from '../host/contracts.ts';
export { readInputDraft } from '../host/input.ts';
export declare function resolveSessionInput(ctx: Context, sessionId: string): SessionInput | null;
export interface Composer {
    readonly machine: boolean;
    readonly pending: boolean;
    readonly hasDraft: boolean;
    appendDraft(text: string): void;
}
export declare function useComposer(ctx: Context, session: SessionFace | undefined, sessionId: string | undefined): Composer;
