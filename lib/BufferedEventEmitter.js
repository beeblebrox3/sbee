import { randomUUID } from "node:crypto";
export const ERR_BUFFER_NOT_FOUND = "BUFFER NOT FOUND";
export const ERR_BUFFER_ALREADY_EXISTS = "BUFFER ALREADY EXISTS";
export const FLUSH_BUFFER_EVENT_NAME = "BUFFER:flush";
export const CLEAN_BUFFER_EVENT_NAME = "BUFFER:clean";
const BUFFER_RETENTION_PERIOD_SECONDS = 1;
const MAINTENANCE_CHANCE = 100;
export class BufferedEventEmitter {
    /**
     * Flag indicating whether debug mode is enabled.
     * Currently, the only difference is that debug mode enables console.log output.
     */
    debug = false;
    /**
     * Map of event names to arrays of event handlers.
     */
    eventListenersMap = new Map();
    /**
     * Stores the buffered messages.
     */
    bufferedMessages = new Map();
    /**
     * TimeToLive: time in seconds that a buffer can exist without activity.
     * After this period it is no longer valid and may be removed by the maintenance process  .
     */
    ttl;
    /**
     * Some method calls have a chance to trigger maintenance, which removes
     * expired buffers that were not flushed. This number defines the chance
     * (as a percentage) that maintenance runs on a method call.
     */
    maintenanceChance;
    constructor(options = {}) {
        this.setTTL(options.ttl ?? BUFFER_RETENTION_PERIOD_SECONDS);
        this.setMaintenanceChance(options.maintenanceChance ?? MAINTENANCE_CHANCE);
    }
    /**
     * Enable/disable debug mode (console.log everywhere ;)
     */
    setDebugMode(value) {
        this.debug = value;
        return this;
    }
    /**
     * Creates a named buffer and returns an object with methods to interact with it.
     */
    createBuffer(bufferId = randomUUID(), context = {}) {
        this.log(`Trying to create buffer ${bufferId}`);
        this.checkMaintenance();
        if (this.bufferExists(bufferId)) {
            throw new Error(ERR_BUFFER_ALREADY_EXISTS);
        }
        const now = Date.now();
        this.bufferedMessages.set(bufferId, {
            id: bufferId,
            context: structuredClone(context),
            created: now,
            lastActivity: now,
            events: {},
        });
        this.log(`Buffer ${bufferId} created`);
        return {
            bufferId,
            emit: this.emitBuffered.bind(this, bufferId),
            flush: this.flush.bind(this, bufferId),
            clean: this.cleanBuffer.bind(this, bufferId),
        };
    }
    /**
     * Add an event to the buffer.
     * The event is stored until the buffer is flushed.
     */
    emitBuffered(bufferId, eventName, ...args) {
        this.log(`Emitting buffered event ${eventName} on buffer ${bufferId}`);
        const buffer = this.internalGetBuffer(bufferId, false);
        if (!(eventName in buffer.events)) {
            this.log(`Creating event ${eventName} on buffer ${bufferId}`);
            buffer.events[eventName] = [];
        }
        buffer.events[eventName].push(structuredClone(args));
        buffer.lastActivity = Date.now();
        this.log(`Buffer ${bufferId} updated`);
        return this;
    }
    /**
     * Flushes the buffer, calling the registered handlers for all events.
     * The buffer is removed after flushing.
     */
    flush(bufferId) {
        this.log(`Trying to flush buffer ${bufferId}`);
        const buffer = this.internalGetBuffer(bufferId, true);
        this.log("Calling handlers for flush event");
        const handlers = this.eventListenersMap.get(FLUSH_BUFFER_EVENT_NAME) ?? [];
        for (const handler of handlers) {
            handler(buffer.id, structuredClone(buffer.context), structuredClone(buffer.events));
        }
        this.log("Calling handlers for buffered events");
        for (const [eventName, events] of Object.entries(buffer.events)) {
            for (const singleEvent of events) {
                this.emit(eventName, ...singleEvent);
            }
        }
        this.bufferedMessages.delete(bufferId);
        return this;
    }
    /**
     * Removes all data from the buffer. Only the global clean buffer event is emitted.
     */
    cleanBuffer(bufferId) {
        this.log(`Cleaning buffer ${bufferId}`);
        const buffer = this.internalGetBuffer(bufferId, true);
        this.log("Calling clean for flush event");
        const handlers = this.eventListenersMap.get(CLEAN_BUFFER_EVENT_NAME) ?? [];
        for (const handler of handlers) {
            handler(buffer.id, structuredClone(buffer.context), structuredClone(buffer.events));
        }
        this.bufferedMessages.delete(bufferId);
        return this;
    }
    /**
     * Adds an event listener.
     * @returns the "unsubscriber". Call this function to unsubscribe the event (or use the unsubscribe method).
     */
    subscribe(eventName, fn) {
        if (typeof eventName !== "string") {
            throw new TypeError("eventName must be a string");
        }
        if (eventName.length === 0) {
            throw new Error("eventName cannot be empty");
        }
        if (!this.eventListenersMap.has(eventName)) {
            this.eventListenersMap.set(eventName, []);
        }
        const handlers = this.eventListenersMap.get(eventName);
        handlers.push(fn);
        return this.unsubscribe.bind(this, eventName, fn);
    }
    /**
     * Adds an event listener to multiple events at the same time.
     *
     * @param eventNames Event names
     * @param fn Handler
     * @returns Unsubscriber for all events
     * @see BufferedEventEmitter.subscribe
     */
    subscribeMultiple(eventNames, fn) {
        const unsubscribes = [];
        for (const eventName of eventNames) {
            unsubscribes.push(this.subscribe(eventName, fn));
        }
        return () => unsubscribes.forEach(unsubscribe => {
            unsubscribe();
        });
    }
    /**
     * Removes an event listener from an event.
     *
     * @param eventName Event name
     * @param fn Handler to remove
     */
    unsubscribe(eventName, fn) {
        if (!this.eventListenersMap.has(eventName)) {
            return this;
        }
        const handlers = this.eventListenersMap.get(eventName) ?? [];
        const handlerIndex = handlers.indexOf(fn);
        if (handlerIndex > -1) {
            handlers.splice(handlerIndex, 1);
        }
        return this;
    }
    /**
     * Removes the event listener from multiple events.
     * @see unsubscribe
     */
    unsubscribeMultiple(eventNames, fn) {
        for (const eventName of eventNames) {
            this.unsubscribe(eventName, fn);
        }
        return this;
    }
    /**
     * Removes all event listeners from the given events.
     */
    unsubscribeAll(eventNames) {
        eventNames.forEach(name => {
            this.eventListenersMap.delete(name);
        });
        return this;
    }
    /**
     * Triggers an event, forwarding all arguments after eventName to the registered
     * event listeners.
     *
     * @param eventName Event name
     * @param args Arguments forwarded to listeners
     */
    emit(eventName, ...args) {
        this.log(`Emitting event ${eventName}`);
        if (!this.eventListenersMap.has(eventName)) {
            return this;
        }
        // clone arguments to prevent handlers from mutating them
        const eventContent = Object.freeze(structuredClone(args));
        this.eventListenersMap.get(eventName)?.forEach(fn => {
            fn(...eventContent);
        });
        return this;
    }
    /**
     * Checks if the buffer exists.
     */
    bufferExists(bufferId) {
        return this.bufferedMessages.has(bufferId);
    }
    getBuffer(bufferId) {
        return this.internalGetBuffer(bufferId, true);
    }
    validateBufferExists(bufferId) {
        if (!this.bufferExists(bufferId)) {
            throw new Error(ERR_BUFFER_NOT_FOUND);
        }
        return this;
    }
    /**
     * Returns a buffer. Unlike getBuffer, this method returns the original buffer by default
     * for performance reasons and should only be used internally. When shouldCopy is true,
     * it returns a deep copy instead. For external usage, use getBuffer.
     */
    internalGetBuffer(bufferId, shouldCopy = false) {
        this.validateBufferExists(bufferId);
        const buffer = this.bufferedMessages.get(bufferId);
        return shouldCopy ? structuredClone(buffer) : buffer;
    }
    /**
     * Checks if maintenance should run and executes it.
     */
    checkMaintenance() {
        this.log("Checking maintenance...");
        if (Math.random() <= this.maintenanceChance / 100) {
            try {
                this.maintenance();
            }
            catch (e) {
                console.error("Failed to run maintenance.", e);
            }
        }
        return this;
    }
    maintenance() {
        this.log("Running maintenance...");
        const now = Date.now();
        this.bufferedMessages.forEach((buffer, id) => {
            const diff = now - buffer.lastActivity;
            const seconds = Math.abs(diff / 1000);
            if (seconds > this.ttl) {
                this.cleanBuffer(id);
            }
        });
        return this;
    }
    setTTL(ttl) {
        if (!Number.isSafeInteger(ttl)) {
            throw new TypeError("Invalid TTL: must be an integer");
        }
        if (ttl < 1) {
            throw new Error("Invalid TTL: must be greater than 0");
        }
        this.ttl = ttl;
        return this;
    }
    setMaintenanceChance(chance) {
        if (typeof chance !== "number" || Number.isNaN(chance)) {
            throw new TypeError("Invalid maintenanceChance: must be numeric");
        }
        if (chance <= 0 || chance > 100) {
            throw new Error("Invalid maintenanceChance: must be greater than 0 and lower than 100");
        }
        this.maintenanceChance = chance;
        return this;
    }
    log(arg) {
        this.debug && console.log(arg);
    }
}
//# sourceMappingURL=BufferedEventEmitter.js.map