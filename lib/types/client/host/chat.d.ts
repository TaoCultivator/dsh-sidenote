import type { Context, ConversationSnapshot, ObservableSnapshot, SessionBinding, SessionReference } from './contracts.ts';
/** Native root status includes approvals and questions, independently of running. */
export declare function sessionStatusSource(ctx: Context): ObservableSnapshot<ReadonlyMap<string, {
    running?: boolean;
    pendingInteraction?: unknown;
}>> | undefined;
/** Durable conversation content; local submission echoes are never part of this face. */
export interface ChatSource {
    subscribe(fn: () => void): () => void;
    getLegacy(): ConversationSnapshot | null;
    getLastTurnEnd?(): {
        seq: number;
        reason: string;
    } | undefined;
    getCompletedReplySeqs?(): readonly number[];
}
export interface ChatReplySnapshot {
    legacy?: ConversationSnapshot;
    timeline: {
        turnOrder: readonly number[];
        turns: ReadonlyMap<number, {
            end?: {
                data: {
                    reason: {
                        kind: string;
                    };
                };
            };
        }>;
    };
    locations: {
        getTurn(turn: number): readonly string[];
    };
    nodes: {
        get(key: string): {
            kind: string;
            data: {
                status?: string;
                finalNode?: {
                    seq: number;
                };
                blocks?: readonly {
                    kind: string;
                    text?: string;
                }[];
            };
        } | undefined;
    };
}
export declare function completedReplySeqsOf(state: ChatReplySnapshot): number[];
export declare function chatSourceOf(ctx: Context, binding: SessionBinding | undefined): ChatSource | undefined;
/** Retain the exact target generation on hosts that expose session ownership. */
export declare function retainSession(ctx: Context, sessionId: string, signal?: AbortSignal): SessionReference | undefined;
