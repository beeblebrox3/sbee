export declare class BufferedEventEmitter {
    private debug;
    private map;
    private bufferedMessages;
    private ttl;
    private maintenanceChanve;
    static FLUSH_BUFFER_EVENT_NAME: string;
    static CLEAN_BUFFER_EVENT_NAME: string;
    constructor(options?: BufferedEventEmitterOptions);
    /**
     * Simple log
     */
    private log;
    /**
     * Enable/disable debug mode (console.log everywhere ;))
     */
    debugEnable(value: boolean): void;
    /**
     * Creates a named buffer
     */
    createBuffer(bufferId: number | string, context?: any): void;
    /**
     * Add and event to the buffer.
     * Will store the event until the buffer is flushed
     */
    emitBuffered(bufferId: number | string, eventName: string, message: any): void;
    /**
     * Flushes the buffer, calling the registered handlers for all events
     * Even when flush returns false, the handlers will be called.
     * Maintenance will try to remove it after a few moments.
     */
    flush(bufferId: string | number): boolean;
    /**
     * Remove all data from the buffer. Just the global clean buffer event will be emitted
     */
    cleanBuffer(bufferId: number | string): boolean;
    /**
     * Add an event listener
     * @returns {Function} the "unsubscriber". Call this function to unsubscribe this event (or use the unsubscribe method)
     */
    subscribe(eventName: string, fn: Function): Function;
    /**
     * @see subscribe
     * Add an event listener to multiple event aht the sabe time
     *
     * @param {String[]} eventNames Event's names
     * @param {Function} fn Handler
     * @return {Function} Unsubscriber for all events
     * @see EventManager.subscribe
     */
    subscribeMultiple(eventNames: string[], fn: Function): Function;
    /**
     * Removes an event listener from an event
     *
     * @param {string} eventName Event's name
     * @param {Function} fn Handler to remove
     */
    unsubscribe(eventName: string, fn: Function): void;
    /**
     * @see unsubscribe
     * Removes the event listener from multiple events
     */
    unsubscribeMultiple(eventNames: string[], fn: Function): void;
    /**
     * Removes all event listeners from the given events
     */
    unsubscribeAll(eventNames: string[]): void;
    /**
     * Trigger an event. Will send all arguments after eventName to the existent
     * event listeners
     *
     * @param {String} eventName Event's name
     *
     * @memberOf EventManager
     */
    emit(eventName: string, ...args: any[]): void;
    private validateBufferExists;
    /**
     * Get the buffer object
     */
    private getBuffer;
    /**
     * Checks if maintenance should be done and do it
     */
    private checkMaintenance;
    private maintenance;
}
/** Options to configure the EventEmiter */
export interface BufferedEventEmitterOptions {
    /**
     * TimeToLive: Time in seconds that the buffer can exists without activity.
     * After this period it is't valid anymore and can eventually will be removed.
     *
     * Example: 10
     */
    ttl?: number;
    /**
     * Every call to some methods will have a chance to run the maintenance, witch
     * is the process of remove expired buffers not flushed. This number define
     * the chance of this process happen on a method call (percentual);
     * Example: 10 => 10% chance of running maintenance
     */
    maintenanceChance?: number;
}
/**
 * The buffer
 */
export interface BufferedEventEmitterBuffer {
    /** Unique id of the buffer */
    id: number | String;
    /**
     * Extra information about the buffer.
     * You can put anything you want in here.
     */
    context: any;
    /**
     * Creation date of the buffer
     */
    created: Date;
    /**
     * Date of the last change of the buffer - usually the creation date of the last
     * event.
     */
    lastActivity: Date;
    /**
     * Store emitted events.
     */
    events: BufferedEventEmitterBufferEvents;
}
/**
 *
 */
export interface BufferedEventEmitterBufferHash {
    [propName: string]: BufferedEventEmitterBuffer;
}
/**
 *
 */
export interface BufferedEventEmitterBufferEvents {
    [propName: string]: any[];
}
