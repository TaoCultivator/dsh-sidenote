import type { Context, InputZone } from '../host/contracts.ts';
import type { AnnotationStore } from './model.ts';
import type { ReflowStore } from '../reflow.ts';
interface ChipProps {
    readonly session: InputZone['session'];
    readonly input: InputZone['input'];
}
export declare function createContextChips(ctx: Context, store: AnnotationStore, reflow: ReflowStore): (props: ChipProps) => import("react").JSX.Element;
export {};
