"use strict";
exports.__esModule = true;
var ERR_BUFFER_NOT_FOUND = "BUFFER NOT FOUND";
var ERR_BUFFER_ALREADY_EXISTS = "BUFFER ALREADY EXISTS";
var FLUSH_BUFFER_EVENT_NAME = "BUFFER:flush";
var CLEAN_BUFFER_EVENT_NAME = "BUFFER:clean";
var BUFFER_RETENTION_PERIOD_SECONDS = 1;
var MAINTENANCE_CHANCE = 100;
var cp = function (object) { return JSON.parse(JSON.stringify(object)); };
var isObject = function (object) { return typeof object === "object"; };
var BufferedEventEmitter = /** @class */ (function () {
    function BufferedEventEmitter(options) {
        if (options === void 0) { options = {}; }
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
    BufferedEventEmitter.prototype.log = function (arg) { this.debug && console.log(arg); };
    /**
     * Enable/disable debug mode (console.log everywhere ;))
     */
    BufferedEventEmitter.prototype.debugEnable = function (value) { this.debug = !!value; };
    /**
     * Creates a named buffer
     */
    BufferedEventEmitter.prototype.createBuffer = function (bufferId, context) {
        if (context === void 0) { context = {}; }
        this.log("Trying to create buffer " + bufferId);
        this.checkMaintenance();
        if (bufferId in this.bufferedMessages === true)
            throw ERR_BUFFER_ALREADY_EXISTS;
        var buffer = {
            id: bufferId,
            context: isObject(context) ? cp(context) : context,
            created: new Date(),
            lastActivity: new Date(),
            events: {}
        };
        this.bufferedMessages[bufferId] = buffer;
        this.log("Buffer " + bufferId + " created");
    };
    /**
     * Add and event to the buffer.
     * Will store the event until the buffer is flushed
     */
    BufferedEventEmitter.prototype.emitBuffered = function (bufferId, eventName, message) {
        this.log("Emitting buffered event " + eventName + " on buffer " + bufferId);
        var buffer = this.getBuffer(bufferId, false);
        if (!buffer.events.hasOwnProperty(eventName)) {
            this.log("Creating event " + eventName + " on buffer " + bufferId);
            buffer.events[eventName] = [];
        }
        var args = Array.prototype.slice.call(arguments, 2);
        buffer.events[eventName].push(args);
        buffer.lastActivity = new Date();
        this.log("Buffer " + bufferId + " updated");
    };
    /**
     * Flushes the buffer, calling the registered handlers for all events
     * Even when flush returns false, the handlers will be called.
     * Maintenance will try to remove it after a few moments.
     */
    BufferedEventEmitter.prototype.flush = function (bufferId) {
        var _this = this;
        this.log("Trying to flush buffer " + bufferId);
        var buffer = this.getBuffer(bufferId, true);
        var context = isObject(buffer.context) ? cp(buffer.context) : buffer.context;
        if (FLUSH_BUFFER_EVENT_NAME in this.map) {
            this.log("Calling handlers for flush event");
            this.map[FLUSH_BUFFER_EVENT_NAME].forEach(function (fn) { return fn.call(null, buffer.id, buffer.context, buffer.events); });
        }
        this.log("Calling handlers for buffered events");
        Object.keys(this.getBuffer(bufferId).events).forEach(function (eventName) {
            if (_this.map.hasOwnProperty(eventName)) {
                _this.getBuffer(bufferId).events[eventName].forEach(function (event) {
                    event.push(isObject(context) ? cp(context) : context);
                    _this.map[eventName].forEach(function (fn) { return fn.apply(_this, event); });
                });
            }
        });
        return delete this.bufferedMessages[bufferId];
    };
    /**
     * Remove all data from the buffer. Just the global clean buffer event will be emitted
     */
    BufferedEventEmitter.prototype.cleanBuffer = function (bufferId) {
        this.log("Cleaning buffer " + bufferId);
        var buffer = this.getBuffer(bufferId, true);
        if (CLEAN_BUFFER_EVENT_NAME in this.map === true) {
            this.log("Calling clean buffer event handler");
            this.map[CLEAN_BUFFER_EVENT_NAME].forEach(function (fn) { return fn.call(null, buffer.id, buffer.context, buffer.events); });
        }
        return delete this.bufferedMessages[bufferId];
    };
    /**
     * Add an event listener
     * @returns {Function} the "unsubscriber". Call this function to unsubscribe this event (or use the unsubscribe method)
     */
    BufferedEventEmitter.prototype.subscribe = function (eventName, fn) {
        if (typeof eventName !== "string")
            throw "eventName must be string";
        if (!eventName.length)
            throw "eventName cannot be empty";
        if (eventName in this.map === false)
            this.map[eventName] = [];
        this.map[eventName].push(fn);
        return this.unsubscribe.bind(this, eventName, fn);
    };
    /**
     * @see subscribe
     * Add an event listener to multiple event aht the sabe time
     *
     * @param {String[]} eventNames Event's names
     * @param {Function} fn Handler
     * @return {Function} Unsubscriber for all events
     * @see EventManager.subscribe
     */
    BufferedEventEmitter.prototype.subscribeMultiple = function (eventNames, fn) {
        var _this = this;
        var unsubscribes = eventNames.map(function (eventName) { return _this.subscribe(eventName, fn); });
        return function () { return unsubscribes.forEach(function (unsubscribe) { return unsubscribe(); }); };
    };
    /**
     * Removes an event listener from an event
     *
     * @param {string} eventName Event's name
     * @param {Function} fn Handler to remove
     */
    BufferedEventEmitter.prototype.unsubscribe = function (eventName, fn) {
        if (!this.map[eventName])
            return;
        var index = this.map[eventName].indexOf(fn);
        if (index !== -1)
            this.map[eventName].splice(index, 1);
    };
    /**
     * @see unsubscribe
     * Removes the event listener from multiple events
     */
    BufferedEventEmitter.prototype.unsubscribeMultiple = function (eventNames, fn) {
        var i, length = eventNames.length;
        for (i = 0; i < length; i++) {
            this.unsubscribe(eventNames[i], fn);
        }
    };
    /**
     * Removes all event listeners from the given events
     */
    BufferedEventEmitter.prototype.unsubscribeAll = function (eventNames) {
        var _this = this;
        eventNames.forEach(function (name) { return name in _this.map && delete _this.map[name]; });
    };
    /**
     * Trigger an event. Will send all arguments after eventName to the existent
     * event listeners
     *
     * @param {String} eventName Event's name
     *
     * @memberOf EventManager
     */
    BufferedEventEmitter.prototype.emit = function (eventName) {
        var _this = this;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        this.log("Emitting event " + eventName);
        if (eventName in this.map === false)
            return;
        // make an copy of the arguments to prevent someone to change it
        this.map[eventName].forEach(function (fn) { return fn.apply(_this, cp(args)); });
    };
    BufferedEventEmitter.prototype.validateBufferExists = function (id) {
        if (id in this.bufferedMessages === false)
            throw ERR_BUFFER_NOT_FOUND;
    };
    /**
     * Get the buffer object
     */
    BufferedEventEmitter.prototype.getBuffer = function (bufferId, shoudCopy) {
        if (shoudCopy === void 0) { shoudCopy = false; }
        this.validateBufferExists(bufferId);
        return shoudCopy ? cp(this.bufferedMessages[bufferId]) : this.bufferedMessages[bufferId];
    };
    /**
     * Checks if maintenance should be done and do it
     */
    BufferedEventEmitter.prototype.checkMaintenance = function () {
        this.log("Checking maintenance...");
        if (Math.random() <= this.maintenanceChanve / 100) {
            try {
                this.maintenance();
            }
            catch (e) {
                console.error("Failed to run maintenance.", e);
            }
        }
    };
    BufferedEventEmitter.prototype.maintenance = function () {
        var _this = this;
        this.log("Running maintenance...");
        Object.keys(this.bufferedMessages).forEach(function (id) {
            var buffer = _this.getBuffer(id);
            var now = new Date();
            var diff = now.getTime() - buffer.lastActivity.getTime();
            var seconds = Math.abs(diff / 1000);
            if (seconds > BUFFER_RETENTION_PERIOD_SECONDS) {
                _this.cleanBuffer(id);
            }
        });
    };
    BufferedEventEmitter.FLUSH_BUFFER_EVENT_NAME = FLUSH_BUFFER_EVENT_NAME;
    BufferedEventEmitter.CLEAN_BUFFER_EVENT_NAME = CLEAN_BUFFER_EVENT_NAME;
    return BufferedEventEmitter;
}());
exports.BufferedEventEmitter = BufferedEventEmitter;
