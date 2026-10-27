import type { Context } from './contracts.ts';
import { type SessionVisibility } from './sessionVisibility.ts';
/**
 * Runtime seam: the host exposes mutable slot entries, but no per-session hide API.
 * Preserve the native entry's store, injection, children and locale. Unknown shapes
 * retain the original list; disposal restores only components we still own.
 */
export declare function registerSessionListFilter(ctx: Context, visibility: SessionVisibility): void;
