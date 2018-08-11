"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ERR_BUFFER_NOT_FOUND = "BUFFER NOT FOUND";
const ERR_BUFFER_ALREADY_EXISTS = "BUFFER ALREADY EXISTS";
const FLUSH_BUFFER_EVENT_NAME = "BUFFER:flush";
const CLEAN_BUFFER_EVENT_NAME = "BUFFER:clean";
const BUFFER_RETENTION_PERIOD_SECONDS = 1;
const MAINTENANCE_CHANCE = 100;
const cp = object => JSON.parse(JSON.stringify(object));
const isObject = object => typeof object === "object";
class BufferedEventEmitter {
    constructor(options = {}) {
        this.debug = false;
        this.map = {};
        this.bufferedMessages = {};
        this.ttl = BUFFER_RETENTION_PERIOD_SECONDS;
        this.maintenanceChanve = MAINTENANCE_CHANCE;
        this.ttl = options.ttl || this.ttl;
        this.maintenanceChanve = options.maintenanceChance || this.maintenanceChanve;
    }
    /**
     * Simple log
     */
    log(arg) { this.debug && console.log(arg); }
    /**
     * Enable/disable debug mode (console.log everywhere ;))
     */
    debugEnable(value) { this.debug = !!value; }
    /**
     * Creates a named buffer
     */
    createBuffer(bufferId, context = {}) {
        this.log(`Trying to create buffer ${bufferId}`);
        this.checkMaintenance();
        if (bufferId in this.bufferedMessages === true)
            throw ERR_BUFFER_ALREADY_EXISTS;
        const buffer = {
            id: bufferId,
            context: isObject(context) ? cp(context) : context,
            created: new Date(),
            lastActivity: new Date(),
            events: {}
        };
        this.bufferedMessages[bufferId] = buffer;
        this.log(`Buffer ${bufferId} created`);
    }
    /**
     * Add and event to the buffer.
     * Will store the event until the buffer is flushed
     */
    emitBuffered(bufferId, eventName, message) {
        this.log(`Emitting buffered event ${eventName} on buffer ${bufferId}`);
        const buffer = this.getBuffer(bufferId, false);
        if (!buffer.events.hasOwnProperty(eventName)) {
            this.log(`Creating event ${eventName} on buffer ${bufferId}`);
            buffer.events[eventName] = [];
        }
        const args = Array.prototype.slice.call(arguments, 2);
        buffer.events[eventName].push(args);
        buffer.lastActivity = new Date();
        this.log(`Buffer ${bufferId} updated`);
    }
    /**
     * Flushes the buffer, calling the registered handlers for all events
     * Even when flush returns false, the handlers will be called.
     * Maintenance will try to remove it after a few moments.
     */
    flush(bufferId) {
        this.log(`Trying to flush buffer ${bufferId}`);
        const buffer = this.getBuffer(bufferId, true);
        const context = isObject(buffer.context) ? cp(buffer.context) : buffer.context;
        if (FLUSH_BUFFER_EVENT_NAME in this.map) {
            this.log(`Calling handlers for flush event`);
            this.map[FLUSH_BUFFER_EVENT_NAME].forEach(fn => fn.call(null, buffer.id, buffer.context, buffer.events));
        }
        this.log(`Calling handlers for buffered events`);
        Object.keys(this.getBuffer(bufferId).events).forEach(eventName => {
            if (this.map.hasOwnProperty(eventName)) {
                this.getBuffer(bufferId).events[eventName].forEach(event => {
                    event.push(isObject(context) ? cp(context) : context);
                    this.map[eventName].forEach(fn => fn.apply(this, event));
                });
            }
        });
        return delete this.bufferedMessages[bufferId];
    }
    /**
     * Remove all data from the buffer. Just the global clean buffer event will be emitted
     */
    cleanBuffer(bufferId) {
        this.log(`Cleaning buffer ${bufferId}`);
        const buffer = this.getBuffer(bufferId, true);
        if (CLEAN_BUFFER_EVENT_NAME in this.map === true) {
            this.log(`Calling clean buffer event handler`);
            this.map[CLEAN_BUFFER_EVENT_NAME].forEach(fn => fn.call(null, buffer.id, buffer.context, buffer.events));
        }
        return delete this.bufferedMessages[bufferId];
    }
    /**
     * Add an event listener
     * @returns {Function} the "unsubscriber". Call this function to unsubscribe this event (or use the unsubscribe method)
     */
    subscribe(eventName, fn) {
        if (typeof eventName !== "string")
            throw "eventName must be string";
        if (!eventName.length)
            throw "eventName cannot be empty";
        if (eventName in this.map === false)
            this.map[eventName] = [];
        this.map[eventName].push(fn);
        return this.unsubscribe.bind(this, eventName, fn);
    }
    /**
     * @see subscribe
     * Add an event listener to multiple event aht the sabe time
     *
     * @param {String[]} eventNames Event's names
     * @param {Function} fn Handler
     * @return {Function} Unsubscriber for all events
     * @see EventManager.subscribe
     */
    subscribeMultiple(eventNames, fn) {
        const unsubscribes = eventNames.map(eventName => this.subscribe(eventName, fn));
        return () => unsubscribes.forEach(unsubscribe => unsubscribe());
    }
    /**
     * Removes an event listener from an event
     *
     * @param {string} eventName Event's name
     * @param {Function} fn Handler to remove
     */
    unsubscribe(eventName, fn) {
        if (!this.map[eventName])
            return;
        let index = this.map[eventName].indexOf(fn);
        if (index !== -1)
            this.map[eventName].splice(index, 1);
    }
    /**
     * @see unsubscribe
     * Removes the event listener from multiple events
     */
    unsubscribeMultiple(eventNames, fn) {
        let i, length = eventNames.length;
        for (i = 0; i < length; i++) {
            this.unsubscribe(eventNames[i], fn);
        }
    }
    /**
     * Removes all event listeners from the given events
     */
    unsubscribeAll(eventNames) {
        eventNames.forEach(name => name in this.map && delete this.map[name]);
    }
    /**
     * Trigger an event. Will send all arguments after eventName to the existent
     * event listeners
     *
     * @param {String} eventName Event's name
     *
     * @memberOf EventManager
     */
    emit(eventName, ...args) {
        this.log(`Emitting event ${eventName}`);
        if (eventName in this.map === false)
            return;
        // make an copy of the arguments to prevent someone to change it
        this.map[eventName].forEach(fn => fn.apply(this, cp(args)));
    }
    validateBufferExists(id) {
        if (id in this.bufferedMessages === false)
            throw ERR_BUFFER_NOT_FOUND;
    }
    /**
     * Get the buffer object
     */
    getBuffer(bufferId, shoudCopy = false) {
        this.validateBufferExists(bufferId);
        return shoudCopy ? cp(this.bufferedMessages[bufferId]) : this.bufferedMessages[bufferId];
    }
    /**
     * Checks if maintenance should be done and do it
     */
    checkMaintenance() {
        this.log("Checking maintenance...");
        if (Math.random() <= this.maintenanceChanve / 100) {
            try {
                this.maintenance();
            }
            catch (e) {
                console.error(`Failed to run maintenance.`, e);
            }
        }
    }
    maintenance() {
        this.log("Running maintenance...");
        Object.keys(this.bufferedMessages).forEach(id => {
            const buffer = this.getBuffer(id);
            const now = new Date();
            const diff = now.getTime() - buffer.lastActivity.getTime();
            const seconds = Math.abs(diff / 1000);
            if (seconds > BUFFER_RETENTION_PERIOD_SECONDS) {
                this.cleanBuffer(id);
            }
        });
    }
}
BufferedEventEmitter.FLUSH_BUFFER_EVENT_NAME = FLUSH_BUFFER_EVENT_NAME;
BufferedEventEmitter.CLEAN_BUFFER_EVENT_NAME = CLEAN_BUFFER_EVENT_NAME;
exports.BufferedEventEmitter = BufferedEventEmitter;
