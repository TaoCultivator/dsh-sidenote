import type { TabComponentProps } from '../host/contracts.ts';
import type { ReflowStore } from '../reflow.ts';
import type { AnnotationStore } from '../annotations/model.ts';
import { type RenderConversation } from './NativeConversation.tsx';
export declare function SideChatPanel(props: TabComponentProps & {
    reflow: ReflowStore;
    annotations: AnnotationStore;
    renderConversation: RenderConversation;
    quoteRequestId?: string;
}): import("react").JSX.Element;
