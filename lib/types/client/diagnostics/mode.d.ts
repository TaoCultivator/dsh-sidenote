export declare function createDiagnosticMode(): {
    getSnapshot: () => {
        enabled: boolean;
        saved: boolean;
    };
    subscribe(fn: () => void): () => void;
    setEnabled(value: boolean): void;
};
export type DiagnosticMode = ReturnType<typeof createDiagnosticMode>;
