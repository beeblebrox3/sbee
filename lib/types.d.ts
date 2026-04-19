export interface CreatedBuffer {
    bufferId: number | string;
    emit: (eventName: string, ...args: [message?: unknown, ...extra: unknown[]]) => void;
    flush: () => void;
    clean: () => void;
}
/** Options to configure the EventEmitter */
export interface BufferedEventEmitterOptions {
    /**
     * TimeToLive: time in seconds that a buffer can exist without activity.
     * After this period it is no longer valid and may be removed.
     *
     * Example: 10
     */
    ttl?: number;
    /**
     * Some method calls have a chance to trigger maintenance, which removes
     * expired buffers that were not flushed. This number defines the chance
     * (as a percentage) that maintenance runs on a method call.
     *
     * Example: 10 => 10% chance of running maintenance
     */
    maintenanceChance?: number;
}
/**
 * The buffer.
 */
export interface BufferedEventEmitterBuffer {
    /** Unique id of the buffer */
    id: number | string;
    /**
     * Extra information about the buffer.
     * You can put anything you want in here.
     */
    context: unknown;
    /**
     * Creation date of the buffer.
     */
    created: Date;
    /**
     * Date of the last change to the buffer — usually the creation date of the last
     * event.
     */
    lastActivity: Date;
    /**
     * Stores emitted events.
     */
    events: BufferedEventEmitterBufferEvents;
}
export interface BufferedEventEmitterBufferHash {
    [propName: string | number]: BufferedEventEmitterBuffer;
}
export interface BufferedEventEmitterBufferEvents {
    [propName: string]: unknown[][];
}
export type EventHandler<T extends any[] = any[]> = (...args: T) => void;
//# sourceMappingURL=types.d.ts.map