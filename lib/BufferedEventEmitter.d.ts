import type { BufferedEventEmitterBuffer, BufferedEventEmitterOptions, CreatedBuffer, EventHandler } from "./types.ts";
export declare const ERR_BUFFER_NOT_FOUND = "BUFFER NOT FOUND";
export declare const ERR_BUFFER_ALREADY_EXISTS = "BUFFER ALREADY EXISTS";
export declare const FLUSH_BUFFER_EVENT_NAME = "BUFFER:flush";
export declare const CLEAN_BUFFER_EVENT_NAME = "BUFFER:clean";
export declare class BufferedEventEmitter {
    private debug;
    private map;
    private bufferedMessages;
    private ttl;
    private maintenanceChance;
    constructor(options?: BufferedEventEmitterOptions);
    /**
     * Enable/disable debug mode (console.log everywhere ;)
     */
    setDebugMode(value: boolean): this;
    /**
     * Creates a named buffer and returns an object with methods to interact with it.
     */
    createBuffer(bufferId?: number | string, context?: unknown): CreatedBuffer;
    /**
     * Add an event to the buffer.
     * The event is stored until the buffer is flushed.
     */
    emitBuffered(bufferId: number | string, eventName: string, ...args: [message?: unknown, ...extra: unknown[]]): this;
    /**
     * Flushes the buffer, calling the registered handlers for all events.
     * The buffer is removed after flushing.
     */
    flush(bufferId: string | number): this;
    /**
     * Removes all data from the buffer. Only the global clean buffer event is emitted.
     */
    cleanBuffer(bufferId: number | string): this;
    /**
     * Adds an event listener.
     * @returns the "unsubscriber". Call this function to unsubscribe the event (or use the unsubscribe method).
     */
    subscribe(eventName: string, fn: EventHandler): CallableFunction;
    /**
     * Adds an event listener to multiple events at the same time.
     *
     * @param eventNames Event names
     * @param fn Handler
     * @returns Unsubscriber for all events
     * @see BufferedEventEmitter.subscribe
     */
    subscribeMultiple(eventNames: string[], fn: EventHandler): () => void;
    /**
     * Removes an event listener from an event.
     *
     * @param eventName Event name
     * @param fn Handler to remove
     */
    unsubscribe(eventName: string, fn: EventHandler): this;
    /**
     * Removes the event listener from multiple events.
     * @see unsubscribe
     */
    unsubscribeMultiple(eventNames: string[], fn: EventHandler): this;
    /**
     * Removes all event listeners from the given events.
     */
    unsubscribeAll(eventNames: string[]): this;
    /**
     * Triggers an event, forwarding all arguments after eventName to the registered
     * event listeners.
     *
     * @param eventName Event name
     * @param args Arguments forwarded to listeners
     */
    emit(eventName: string, ...args: unknown[]): this;
    /**
     * Checks if the buffer exists.
     */
    bufferExists(id: number | string): boolean;
    getBuffer(id: number | string): BufferedEventEmitterBuffer;
    private validateBufferExists;
    /**
     * Returns a buffer. Unlike getBuffer, this method returns the original buffer by default
     * for performance reasons and should only be used internally. When shouldCopy is true,
     * it returns a deep copy instead. For external usage, use getBuffer.
     */
    private internalGetBuffer;
    /**
     * Checks if maintenance should run and executes it.
     */
    private checkMaintenance;
    private maintenance;
    private setTTL;
    private setMaintenanceChance;
    private log;
}
//# sourceMappingURL=BufferedEventEmitter.d.ts.map