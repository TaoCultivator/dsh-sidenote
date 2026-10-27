/**
 * The annotation store: per-session numbered selection annotations. Pure
 * (DOM-free, React-free) so the whole lifecycle is unit-testable. One instance
 * per plugin activation.
 *
 * Numbering（2026-10-14 用户裁定 · 按轮重置）: 展示号 = **本轮待发送批次内的
 * 序号**。一批 = 上一次发送完成到下一次发送之间的全部 active 注释；批内新增从
 * 1 递增、删除后重排为连续的 1..n，因此同一会话里第二轮批注重新从 1 开始，不再
 * 跨轮累加（旧行为 = per-session 单调计数器，永不重置）。
 * 发送时编号随该批冻结：sent 保留发送当时的号、永不重排，保证已发出消息的
 * 角标 / wire `<annotation id>` / 气泡留痕三者编号一致。
 *
 * State machine per annotation: 'active' (counts in the composer chip, rides
 * the next message via the send interceptor) → 'sent' (the message it was
 * attached to went out; badge turns gray/read-only, chip no longer counts it).
 *
 * 持久化（Delivery_02 起）：每次 mutation 后按会话写 localStorage
 * （`dsh-sidenote:annotations:v1:<sessionId>`），刷新/切会话后重建；
 * 会话清空时删键。storage 不可用（测试/隐私模式）时退化为纯内存。
 */
export interface Annotation {
    /** Store-unique identity (monotonic across sessions). */
    readonly id: number;
    /** 本轮待发送批次内的展示号（1..n）；发送时随该批冻结，sent 后永不重排。 */
    readonly number: number;
    readonly sessionId: string;
    /** Source is independent of the send target. Missing fields revive legacy main quotes. */
    readonly sourceSessionId?: string;
    readonly sourceSurface?: 'main' | 'side';
    /** `data-chat-anchor-key` of the owning message (re-anchor key). */
    readonly anchorKey: string | undefined;
    /** Full human-selected quote; chip truncation is visual only. */
    readonly text: string;
    /** Full selection text (re-anchor needle; untruncated). */
    readonly anchorText: string;
    /** 0-based ordinal of the quote's occurrence inside the anchor element. */
    readonly occurrence: number;
    /** User-written note; '' means 纯引用. */
    readonly note: string;
    readonly state: 'active' | 'sent';
    readonly createdAt: number;
}
export interface AnnotationDraft {
    readonly sessionId: string;
    readonly sourceSessionId?: string;
    readonly sourceSurface?: 'main' | 'side';
    readonly anchorKey: string | undefined;
    readonly text: string;
    readonly anchorText: string;
    readonly occurrence: number;
    readonly note: string;
}
export interface AnnotationStore {
    /** Monotonic version, referentially stable between mutations (uSES-ready). */
    getSnapshot(): number;
    /** Memory contents remain usable after storage access/quota failures. */
    getStorageStatus(sessionId?: string): 'persistent' | 'memory';
    getSubmission(sessionId: string): {
        readonly pending: boolean;
        readonly error?: string;
    };
    setSubmission(sessionId: string, state: {
        pending: boolean;
        error?: string;
    }): void;
    subscribe(fn: () => void): () => void;
    /** Create an active annotation; returns it (id/number assigned). */
    add(draft: AnnotationDraft): Annotation;
    setNote(id: number, note: string): void;
    remove(id: number): void;
    /** 把指定 id 的 active 注释翻为 'sent'（发送拦截器只翻当时拼进消息的
     *  那批——窗口内新增的注释不得误标，C2 P1-3）。 */
    markSent(ids: readonly number[]): void;
    get(id: number): Annotation | undefined;
    /** All annotations of a session in creation order (active + sent). */
    list(sessionId: string): readonly Annotation[];
    listActive(sessionId: string): readonly Annotation[];
    countActive(sessionId: string): number;
    /** Sessions currently holding any annotation (draft-sync fan-out). */
    sessions(): readonly string[];
}
/** localStorage 键前缀（按会话分键）。 */
export declare const STORAGE_PREFIX = "dsh-sidenote:annotations:v1:";
export declare function createAnnotationStore(now?: () => number, storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | null): AnnotationStore;
