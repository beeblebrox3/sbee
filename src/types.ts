/** Options to configure the EventEmiter */
export interface BufferedEventEmitterOptions {
    /**
     * TimeToLive: Time in seconds that the buffer can exists without activity.
     * After this period it is't valid anymore and can eventually will be removed.
     *
     * Example: 10
     */
    ttl?: number

    /**
     * Every call to some methods will have a chance to run the maintenance, witch
     * is the process of remove expired buffers not flushed. This number define
     * the chance of this process happen on a method call (percentual);
     * Example: 10 => 10% chance of running maintenance
     */
    maintenanceChance?: number
}

/**
 * The buffer
 */
export interface BufferedEventEmitterBuffer {
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
export interface BufferedEventEmitterBufferHash {
    [propName: string]: BufferedEventEmitterBuffer
}

/**
 *
 */
export interface BufferedEventEmitterBufferEvents {
    [propName: string]: any[]
}