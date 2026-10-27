import type { Context } from '../host/contracts.ts';
import { type ProtocolPrefix } from './format.ts';
interface HistoryNode {
    kind: string;
    seq: number;
    source?: {
        kind?: string;
    };
    content?: readonly {
        type: string;
        text?: string;
    }[];
}
/** Injected notices and their following human input are one admitted batch.
 * Project its reflows into that bubble without changing or resending history. */
export declare function injectedReflowPrefix(nodes: readonly HistoryNode[], seq: number): string;
/** One prefix node leaves the body, @ references and attachments to the host. */
export declare const sentContextRule: {
    id: string;
    order: number;
    match(text: string, from: number): {
        id: string;
        start: number;
        end: number;
        data: ProtocolPrefix;
    } | undefined;
};
export declare function SentContext({ protocol, interactive }: {
    protocol: ProtocolPrefix;
    interactive?: boolean;
}): import("react").JSX.Element;
/** Keep contextual chips inside the native bubble on both main and side chat.
 * Only the progress snapshot remains outside its owning user message. */
export declare function registerUserContext(ctx: Context): void;
export {};
