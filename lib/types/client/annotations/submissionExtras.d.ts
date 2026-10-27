/** Extra context belongs to one mounted conversation; the native input still owns submission. */
export interface SubmissionExtras {
    firstSendPrefix(): string | null;
    onAccepted(): void;
    onSubmitText(body: string): void;
}
export declare function submissionExtrasOf(sessionId: string): SubmissionExtras | undefined;
export declare function registerSubmissionExtras(sessionId: string, value: SubmissionExtras): () => void;
