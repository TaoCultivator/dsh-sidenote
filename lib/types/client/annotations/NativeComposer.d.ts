import type { Context } from '../host/contracts.ts';
import type { AnnotationStore } from './model.ts';
import type { ReflowStore } from '../reflow.ts';
type Submit = (mode?: 'queue' | 'steer', source?: 'click' | 'enter') => void;
/** The host has already resolved Enter/click, menus, IME and busy delivery mode. */
export declare function submitNativeWithContext(ctx: Context, annotations: AnnotationStore, reflow: ReflowStore, sessionId: string, native: Submit, mode?: 'queue' | 'steer', source?: 'click' | 'enter'): void;
/** Keep the native editor and controls; replace only its empty submit seat
 * while plugin-owned context exists, and retain a separate native Stop. */
export declare function registerNativeComposer(ctx: Context, annotations: AnnotationStore, reflow: ReflowStore): void;
export {};
