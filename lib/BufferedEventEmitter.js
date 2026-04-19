import { randomUUID } from "node:crypto";
export const ERR_BUFFER_NOT_FOUND = "BUFFER NOT FOUND";
export const ERR_BUFFER_ALREADY_EXISTS = "BUFFER ALREADY EXISTS";
export const FLUSH_BUFFER_EVENT_NAME = "BUFFER:flush";
export const CLEAN_BUFFER_EVENT_NAME = "BUFFER:clean";
const BUFFER_RETENTION_PERIOD_SECONDS = 1;
const MAINTENANCE_CHANCE = 100;
export class BufferedEventEmitter {
    debug = false;
    map = {};
    bufferedMessages = {};
    ttl;
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
        if (bufferId in this.bufferedMessages)
            throw new Error(ERR_BUFFER_ALREADY_EXISTS);
        const now = new Date();
        this.bufferedMessages[bufferId] = {
            id: bufferId,
            context: structuredClone(context),
            created: now,
            lastActivity: now,
            events: {},
        };
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
        buffer.lastActivity = new Date();
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
        if (FLUSH_BUFFER_EVENT_NAME in this.map) {
            this.log("Calling handlers for flush event");
            this.map[FLUSH_BUFFER_EVENT_NAME].forEach(fn => {
                fn(buffer.id, structuredClone(buffer.context), structuredClone(buffer.events));
            });
        }
        this.log("Calling handlers for buffered events");
        for (const [eventName, events] of Object.entries(buffer.events)) {
            for (const singleEvent of events) {
                this.emit(eventName, ...singleEvent);
            }
        }
        delete this.bufferedMessages[bufferId];
        return this;
    }
    /**
     * Removes all data from the buffer. Only the global clean buffer event is emitted.
     */
    cleanBuffer(bufferId) {
        this.log(`Cleaning buffer ${bufferId}`);
        const buffer = this.internalGetBuffer(bufferId, true);
        if (CLEAN_BUFFER_EVENT_NAME in this.map) {
            this.log("Calling clean for flush event");
            this.map[CLEAN_BUFFER_EVENT_NAME].forEach(fn => {
                fn(buffer.id, structuredClone(buffer.context), structuredClone(buffer.events));
            });
        }
        delete this.bufferedMessages[bufferId];
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
        if (eventName.length === 0)
            throw new Error("eventName cannot be empty");
        if (!(eventName in this.map))
            this.map[eventName] = [];
        this.map[eventName].push(fn);
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
        const unsubscribes = eventNames.map(eventName => this.subscribe(eventName, fn));
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
        if (!(eventName in this.map)) {
            return this;
        }
        const index = this.map[eventName].indexOf(fn);
        if (index !== -1)
            this.map[eventName].splice(index, 1);
        return this;
    }
    /**
     * Removes the event listener from multiple events.
     * @see unsubscribe
     */
    unsubscribeMultiple(eventNames, fn) {
        const length = eventNames.length;
        for (let i = 0; i < length; i++) {
            this.unsubscribe(eventNames[i], fn);
        }
        return this;
    }
    /**
     * Removes all event listeners from the given events.
     */
    unsubscribeAll(eventNames) {
        eventNames.forEach(name => {
            name in this.map && delete this.map[name];
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
        if (!(eventName in this.map))
            return this;
        // clone arguments to prevent handlers from mutating them
        const eventContent = Object.freeze(structuredClone(args));
        this.map[eventName].forEach(fn => {
            fn(...eventContent);
        });
        return this;
    }
    /**
     * Checks if the buffer exists.
     */
    bufferExists(id) {
        return id in this.bufferedMessages;
    }
    getBuffer(id) {
        return this.internalGetBuffer(id, true);
    }
    validateBufferExists(id) {
        if (!this.bufferExists(id))
            throw new Error(ERR_BUFFER_NOT_FOUND);
        return this;
    }
    /**
     * Returns a buffer. Unlike getBuffer, this method returns the original buffer by default
     * for performance reasons and should only be used internally. When shouldCopy is true,
     * it returns a deep copy instead. For external usage, use getBuffer.
     */
    internalGetBuffer(bufferId, shouldCopy = false) {
        this.validateBufferExists(bufferId);
        const buffer = this.bufferedMessages[bufferId];
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
        const now = new Date();
        Object.keys(this.bufferedMessages).forEach(id => {
            const buffer = this.internalGetBuffer(id);
            const diff = now.getTime() - buffer.lastActivity.getTime();
            const seconds = Math.abs(diff / 1000);
            if (seconds > this.ttl) {
                this.cleanBuffer(id);
            }
        });
        return this;
    }
    setTTL(ttl) {
        if (!Number.isSafeInteger(ttl))
            throw new Error("Invalid TTL: must be an integer");
        if (ttl < 1)
            throw new Error("Invalid TTL: must be greater than 0");
        this.ttl = ttl;
        return this;
    }
    setMaintenanceChance(chance) {
        if (Number.isNaN(chance))
            throw new Error("Invalid maintenanceChance: must be numeric");
        if (chance <= 0 || chance > 100)
            throw new Error("Invalid maintenanceChance: must be greater than 0 and lower than 100");
        this.maintenanceChance = chance;
        return this;
    }
    log(arg) {
        this.debug && console.log(arg);
    }
}
//# sourceMappingURL=BufferedEventEmitter.js.map