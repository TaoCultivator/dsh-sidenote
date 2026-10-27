import type { Context } from '../host/contracts.ts';
/** Run before orphan-meta cleanup so previous live/closed children can migrate. */
export declare function registerSideSessionVisibility(ctx: Context): void;
