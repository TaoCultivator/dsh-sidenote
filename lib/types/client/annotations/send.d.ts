import type { Context, SessionInput } from '../host/contracts.ts';
import type { Annotation, AnnotationStore } from './model.ts';
import { type ReflowStore } from '../reflow.ts';
/** Main and side composers use this same native transaction and acceptance boundary. */
export declare function submitAnnotations(options: {
    ctx: Context;
    store: AnnotationStore;
    sessionId: string;
    input: SessionInput;
    annotations: readonly Annotation[];
    leadingBlocks?: readonly string[];
    mode?: 'queue' | 'steer';
}): Promise<boolean>;
/** Shared by native input gestures and the explicit annotation/reflow actions. */
export declare function submitControlledInput(ctx: Context, store: AnnotationStore, reflow: ReflowStore, sessionId: string, mode?: 'queue' | 'steer'): Promise<boolean>;
