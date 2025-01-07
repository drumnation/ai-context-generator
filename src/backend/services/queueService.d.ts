import * as vscode from 'vscode';
export interface QueueItem<T> {
    data: T;
    priority: number;
}
export interface ProcessingOptions {
    chunkSize: number;
    delayBetweenChunks: number;
    cancelToken?: vscode.CancellationToken;
}
export declare class QueueService {
    private queue;
    private isProcessing;
    private currentProgress;
    enqueue<T>(item: T, priority?: number): Promise<void>;
    processChunked<T, R>(items: T[], processor: (item: T) => Promise<R>, options: ProcessingOptions): Promise<R[]>;
    private chunkArray;
    clearQueue(): void;
    get currentQueueSize(): number;
}
