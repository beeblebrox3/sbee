import { randomUUID } from "node:crypto";
import type {
  BufferedEventEmitterBuffer,
  BufferedEventEmitterOptions,
  CreatedBuffer,
  EventHandler,
} from "./types.ts";

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
  private debug = false;

  /**
   * Map of event names to arrays of event handlers.
   */
  private eventListenersMap = new Map<string, EventHandler[]>();

  /**
   * Stores the buffered messages.
   */
  private bufferedMessages = new Map<
    string | number,
    BufferedEventEmitterBuffer
  >();

  /**
   * TimeToLive: time in seconds that a buffer can exist without activity.
   * After this period it is no longer valid and may be removed by the maintenance process  .
   */
  private ttl!: number;

  /**
   * Some method calls have a chance to trigger maintenance, which removes
   * expired buffers that were not flushed. This number defines the chance
   * (as a percentage) that maintenance runs on a method call.
   */
  private maintenanceChance!: number;

  public constructor(options: BufferedEventEmitterOptions = {}) {
    this.setTTL(options.ttl ?? BUFFER_RETENTION_PERIOD_SECONDS);
    this.setMaintenanceChance(options.maintenanceChance ?? MAINTENANCE_CHANCE);
  }

  /**
   * Enable/disable debug mode (console.log everywhere ;)
   */
  public setDebugMode(value: boolean): this {
    this.debug = value;
    return this;
  }

  /**
   * Creates a named buffer and returns an object with methods to interact with it.
   */
  public createBuffer(
    bufferId: number | string = randomUUID(),
    context: unknown = {}
  ): CreatedBuffer {
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
  public emitBuffered(
    bufferId: number | string,
    eventName: string,
    ...args: [message?: unknown, ...extra: unknown[]]
  ): this {
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
  public flush(bufferId: string | number): this {
    this.log(`Trying to flush buffer ${bufferId}`);

    const buffer = this.internalGetBuffer(bufferId, true);

    this.log("Calling handlers for flush event");
    const handlers = this.eventListenersMap.get(FLUSH_BUFFER_EVENT_NAME) ?? [];

    for (const handler of handlers) {
      handler(
        buffer.id,
        structuredClone(buffer.context),
        structuredClone(buffer.events)
      );
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
  public cleanBuffer(bufferId: number | string): this {
    this.log(`Cleaning buffer ${bufferId}`);
    const buffer = this.internalGetBuffer(bufferId, true);

    this.log("Calling clean for flush event");
    const handlers = this.eventListenersMap.get(CLEAN_BUFFER_EVENT_NAME) ?? [];

    for (const handler of handlers) {
      handler(
        buffer.id,
        structuredClone(buffer.context),
        structuredClone(buffer.events)
      );
    }

    this.bufferedMessages.delete(bufferId);
    return this;
  }

  /**
   * Adds an event listener.
   * @returns the "unsubscriber". Call this function to unsubscribe the event (or use the unsubscribe method).
   */
  public subscribe(eventName: string, fn: EventHandler): CallableFunction {
    if (typeof eventName !== "string") {
      throw new TypeError("eventName must be a string");
    }

    if (eventName.length === 0) {
      throw new Error("eventName cannot be empty");
    }

    if (!this.eventListenersMap.has(eventName)) {
      this.eventListenersMap.set(eventName, []);
    }

    const handlers = this.eventListenersMap.get(eventName)!;
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
  public subscribeMultiple(eventNames: string[], fn: EventHandler): () => void {
    const unsubscribes: CallableFunction[] = [];
    for (let i = 0; i < eventNames.length; i++) {
      unsubscribes.push(this.subscribe(eventNames[i], fn));
    }

    return () =>
      unsubscribes.forEach(unsubscribe => {
        unsubscribe();
      });
  }

  /**
   * Removes an event listener from an event.
   *
   * @param eventName Event name
   * @param fn Handler to remove
   */
  public unsubscribe(eventName: string, fn: EventHandler): this {
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
  public unsubscribeMultiple(eventNames: string[], fn: EventHandler): this {
    for (let i = 0; i < eventNames.length; i++) {
      this.unsubscribe(eventNames[i], fn);
    }
    return this;
  }

  /**
   * Removes all event listeners from the given events.
   */
  public unsubscribeAll(eventNames: string[]): this {
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
  public emit(eventName: string, ...args: unknown[]): this {
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
  public bufferExists(bufferId: number | string): boolean {
    return this.bufferedMessages.has(bufferId);
  }

  public getBuffer(bufferId: number | string): BufferedEventEmitterBuffer {
    return this.internalGetBuffer(bufferId, true);
  }

  private validateBufferExists(bufferId: number | string): this {
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
  private internalGetBuffer(
    bufferId: number | string,
    shouldCopy: boolean = false
  ): BufferedEventEmitterBuffer {
    this.validateBufferExists(bufferId);

    const buffer = this.bufferedMessages.get(bufferId)!;
    return shouldCopy ? structuredClone(buffer) : buffer;
  }

  /**
   * Checks if maintenance should run and executes it.
   */
  private checkMaintenance(): this {
    this.log("Checking maintenance...");

    if (Math.random() <= this.maintenanceChance / 100) {
      try {
        this.maintenance();
      } catch (e) {
        console.error("Failed to run maintenance.", e);
      }
    }

    return this;
  }

  private maintenance(): this {
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

  private setTTL(ttl: number): this {
    if (!Number.isSafeInteger(ttl)) {
      throw new Error("Invalid TTL: must be an integer");
    }

    if (ttl < 1) {
      throw new Error("Invalid TTL: must be greater than 0");
    }

    this.ttl = ttl;
    return this;
  }

  private setMaintenanceChance(chance: number): this {
    if (Number.isNaN(chance)) {
      throw new Error("Invalid maintenanceChance: must be numeric");
    }

    if (chance <= 0 || chance > 100) {
      throw new Error(
        "Invalid maintenanceChance: must be greater than 0 and lower than 100"
      );
    }

    this.maintenanceChance = chance;
    return this;
  }

  private log(arg: unknown): void {
    this.debug && console.log(arg);
  }
}
