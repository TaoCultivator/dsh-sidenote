import { type ComponentType, type ReactNode } from 'react';
import type { Context, SessionReference } from '../host/contracts.ts';
import { type ChatMessage } from '../chat/transcript.ts';
import type { SnapshotEntry } from './snapshot.ts';
import type { ReflowStore } from '../reflow.ts';
export interface SideConversation {
    sessionId: string;
    parentSessionId: string;
    title: string;
    boundarySeq?: number;
    reflow: ReflowStore;
    contextExpanded?: boolean;
    contextPending?: boolean;
    progress?: {
        entries: SnapshotEntry[];
        takenAt?: string | null;
    };
}
export interface ConversationRendererProps {
    SessionProvider: ComponentType<{
        session: SessionReference;
        children?: ReactNode;
    }>;
    renderSlot(name: 'sidenote.conversation', owner: Record<string, never>): ReactNode;
}
export type RenderConversation = (reference: SessionReference, side: SideConversation) => ReactNode;
export declare function renderSideConversation(props: ConversationRendererProps, reference: SessionReference, side: SideConversation): ReactNode;
/** Only completed, fork-local final answers are eligible for reflow. */
export declare function finalReplies(messages: readonly ChatMessage[], boundarySeq?: number, completed?: ReadonlySet<number>): ChatMessage[];
export declare function isReplyAdded(side: SideConversation, message: ChatMessage, question?: string): boolean;
export declare function addReply(side: SideConversation, message: ChatMessage, question?: string): void;
export declare function registerNativeConversation(ctx: Context): void;
