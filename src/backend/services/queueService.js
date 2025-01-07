"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../../shared/logger");
class QueueService {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }
    async enqueue(item, priority = 0) {
        this.queue.push({ data: item, priority });
        this.queue.sort((a, b) => b.priority - a.priority);
    }
    async processChunked(items, processor, options) {
        const results = [];
        const chunks = this.chunkArray(items, options.chunkSize);
        let processedCount = 0;
        const totalItems = items.length;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Processing files...',
            cancellable: true,
        }, async (progress, token) => {
            this.currentProgress = progress;
            for (const chunk of chunks) {
                if (token.isCancellationRequested ||
                    options.cancelToken?.isCancellationRequested) {
                    logger_1.logger.info('Processing cancelled by user');
                    break;
                }
                const chunkResults = await Promise.all(chunk.map((item) => processor(item)));
                results.push(...chunkResults);
                processedCount += chunk.length;
                const increment = (chunk.length / totalItems) * 100;
                progress.report({
                    increment,
                    message: `Processed ${processedCount} of ${totalItems} items`,
                });
                // Add delay between chunks to prevent UI freezing
                if (options.delayBetweenChunks > 0) {
                    await new Promise((resolve) => setTimeout(resolve, options.delayBetweenChunks));
                }
            }
        });
        return results;
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    clearQueue() {
        this.queue = [];
        this.isProcessing = false;
    }
    get currentQueueSize() {
        return this.queue.length;
    }
}
exports.QueueService = QueueService;
//# sourceMappingURL=queueService.js.map