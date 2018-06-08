interface BufferedEventEmitter {
    constructor(options: BufferedEventEmitterOptions)

    createBuffer(bufferId: Number|String, context: any): void
    clearBuffer(bufferId: Number|String): Boolean
    flush(bufferId: Number|String): Boolean
    emit(eventName: String, data: any): void
    emitBuffered(bufferId: Number|String, eventName: String, data: any): void
    subscribe(eventName: String, handler: Function): Function
    subscribeMultiple(eventsName: String[], handler: Function): Function
    unsubscribe(eventName: String, handler: Function): void
    unsubscribeMultiple(eventsName: String, handler: Function): void
    unsubscribeAll(eventsName: String): void

    debugEnable(value: Boolean): void

    FLUSH_BUFFER_EVENT_NAME: string
    CLEAN_BUFFER_EVENT_NAME: string
}

/** Options to configure the EventEmiter */
interface BufferedEventEmitterOptions {
    /**
     * TimeToLive: Time in seconds that the buffer can exists without activity.
     * After this period it is't valid anymore and can eventually will be removed.
     */
    ttl?: number

    /**
     * Every call to some methods will have a chance to run the maintenance, witch
     * is the process of remove expired buffers not flushed. This number define
     * the chance of this process happen on a method call (percentual);
     * Examploe: 10 => 10% chance of running maintenance
     */
    maintenanceChance?: number
}

/**
 * The buffer
 */
interface BufferedEventEmitterBuffer {
    /** Unique id of the buffer */
    id: number|String

    /**
     * Extra information about the buffer.
     * You can put anything you want in here.
     */
    context: any

    /**
     * Creation date of the buffer
     */
    created: Date

    /**
     * Date of the last change of the buffer - usually the creation date of the last
     * event.
     */
    lastActivity: Date

    /**
     * Store emitted events.
     */
    events: BufferedEventEmitterBufferEvents
}

/**
 *
 */
interface BufferedEventEmitterBufferHash {
    [propName: string]: BufferedEventEmitterBuffer
}

/**
 *
 */
interface BufferedEventEmitterBufferEvents {
    [propName: string]: any[]
}