import type { Context } from './contracts.ts';
/** uiWorkspace owns navigation on newer hosts; historical hosts use sessions.open. */
export declare function openSession(ctx: Context, sessionId: string): void;
