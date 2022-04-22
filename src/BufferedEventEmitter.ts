const ERR_BUFFER_NOT_FOUND = 'BUFFER NOT FOUND'
const ERR_BUFFER_ALREADY_EXISTS = 'BUFFER ALREADY EXISTS'

const FLUSH_BUFFER_EVENT_NAME = 'BUFFER:flush'
const CLEAN_BUFFER_EVENT_NAME = 'BUFFER:clean'

const BUFFER_RETENTION_PERIOD_SECONDS = 1
const MAINTENANCE_CHANCE = 100

function copy<T extends Object> (object: T): T {
  return JSON.parse(JSON.stringify(object))
}

function isObject (object: any): boolean {
  return typeof object === 'object'
}

export class BufferedEventEmitter {
  private debug = false
  private map = {}
  private bufferedMessages: BufferedEventEmitterBufferHash = {}
  private ttl: number
  private maintenanceChance: number

  public static FLUSH_BUFFER_EVENT_NAME = FLUSH_BUFFER_EVENT_NAME
  public static CLEAN_BUFFER_EVENT_NAME = CLEAN_BUFFER_EVENT_NAME

  constructor (options: BufferedEventEmitterOptions = {}) {
    this.setTTL(options?.ttl ?? BUFFER_RETENTION_PERIOD_SECONDS)
      .setMaintenanceChance(options?.maintenanceChance ?? MAINTENANCE_CHANCE)
  }

  /**
   * Enable/disable debug mode (console.log everywhere ;))
   */
  public setDebugMode (value: boolean): this {
    this.debug = value
    return this
  }

  /**
   * Creates a named buffer
   */
  public createBuffer (bufferId: number | string, context: any = {}): this {
    this.log(`Trying to create buffer ${bufferId}`)
    this.checkMaintenance()

    if (bufferId in this.bufferedMessages) throw new Error(ERR_BUFFER_ALREADY_EXISTS)

    const now = new Date()
    this.bufferedMessages[bufferId] = {
      id: bufferId,
      context: isObject(context) ? copy(context) : context,
      created: now,
      lastActivity: now,
      events: {}
    }
    this.log(`Buffer ${bufferId} created`)
    return this
  }

  /**
   * Add and event to the buffer.
   * Will store the event until the buffer is flushed
   */
  public emitBuffered (bufferId: number | string, eventName: string, message: any): this {
    this.log(`Emitting buffered event ${eventName} on buffer ${bufferId}`)

    const buffer = this.getBuffer(bufferId, false)
    if (!(eventName in buffer.events)) {
      this.log(`Creating event ${eventName} on buffer ${bufferId}`)
      buffer.events[eventName] = []
    }

    const args = Array.prototype.slice.call(arguments, 2)
    buffer.events[eventName].push(args)
    buffer.lastActivity = new Date()

    this.log(`Buffer ${bufferId} updated`)
    return this
  }

  /**
   * Flushes the buffer, calling the registered handlers for all events
   * Maintenance will try to remove it after a few moments.
   */
  public flush (bufferId: string | number): this {
    this.log(`Trying to flush buffer ${bufferId}`)

    const buffer = this.getBuffer(bufferId, true)
    const context = isObject(buffer.context) ? copy(buffer.context) : buffer.context

    if (FLUSH_BUFFER_EVENT_NAME in this.map) {
      this.log('Calling handlers for flush event')
      this.map[FLUSH_BUFFER_EVENT_NAME].forEach(fn => fn(buffer.id, buffer.context, buffer.events))
    }

    this.log('Calling handlers for buffered events')
    Object.keys(buffer.events).forEach(eventName => {
      if (eventName in this.map) {
        buffer.events[eventName].forEach(event => {
          event.push(isObject(context) ? copy(context) : context)

          this.map[eventName].forEach(fn => fn.apply(this, event))
        })
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.bufferedMessages[bufferId]
    return this
  }

  /**
   * Remove all data from the buffer. Just the global clean buffer event will be emitted
   */
  public cleanBuffer (bufferId: number | string): this {
    this.log(`Cleaning buffer ${bufferId}`)
    const buffer = this.getBuffer(bufferId, true)

    if (BufferedEventEmitter.CLEAN_BUFFER_EVENT_NAME in this.map) {
      this.log('Calling clean buffer event handler')
      this.map[BufferedEventEmitter.CLEAN_BUFFER_EVENT_NAME].forEach(fn => fn(buffer.id, buffer.context, buffer.events))
    }

    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.bufferedMessages[bufferId]
    return this
  }

  /**
   * Add an event listener
   * @returns {Function} the "unsubscriber". Call this function to unsubscribe this event (or use the unsubscribe method)
   */
  public subscribe (eventName: string, fn: Function): Function {
    if (typeof eventName !== 'string') throw new Error('eventName must be string')
    if (eventName.length === 0) throw new Error('eventName cannot be empty')

    if (!(eventName in this.map)) this.map[eventName] = []

    this.map[eventName].push(fn)
    return this.unsubscribe.bind(this, eventName, fn)
  }

  /**
   * @see subscribe
   * Add an event listener to multiple event aht the same time
   *
   * @param {String[]} eventNames Event's names
   * @param {Function} fn Handler
   * @return {Function} Unsubscriber for all events
   * @see EventManager.subscribe
   */
  public subscribeMultiple (eventNames: string[], fn: Function): Function {
    const unsubscribes = eventNames.map(eventName => this.subscribe(eventName, fn))
    return () => unsubscribes.forEach(unsubscribe => unsubscribe())
  }

  /**
   * Removes an event listener from an event
   *
   * @param {string} eventName Event's name
   * @param {Function} fn Handler to remove
   */
  public unsubscribe (eventName: string, fn: Function): this {
    if (!(eventName in this.map)) {
      return this
    }

    const index = this.map[eventName].indexOf(fn)
    if (index !== -1) this.map[eventName].splice(index, 1)
    return this
  }

  /**
   * @see unsubscribe
   * Removes the event listener from multiple events
   */
  public unsubscribeMultiple (eventNames: string[], fn: Function): this {
    let i
    const length = eventNames.length

    for (i = 0; i < length; i++) {
      this.unsubscribe(eventNames[i], fn)
    }
    return this
  }

  /**
   * Removes all event listeners from the given events
   */
  public unsubscribeAll (eventNames: string[]): this {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    eventNames.forEach(name => name in this.map && delete this.map[name])
    return this
  }

  /**
   * Trigger an event. Will send all arguments after eventName to the existent
   * event listeners
   *
   * @param {String} eventName Event's name
   * @param {...*} args
   * @memberOf EventManager
   */
  public emit (eventName: string, ...args): this {
    this.log(`Emitting event ${eventName}`)
    if (!(eventName in this.map)) return this

    // make an copy of the arguments to prevent someone to change it
    this.map[eventName].forEach(fn => fn.apply(this, copy(args)))
    return this
  }

  private validateBufferExists (id: number | string): this {
    if (!(id in this.bufferedMessages)) throw new Error(ERR_BUFFER_NOT_FOUND)
    return this
  }

  /**
   * Get the buffer object
   */
  private getBuffer (bufferId: number | string, shouldCopy: boolean = false): BufferedEventEmitterBuffer {
    this.validateBufferExists(bufferId)
    const buffer = this.bufferedMessages[bufferId]

    return shouldCopy ? copy(buffer) : buffer
  }

  /**
   * Checks if maintenance should be done and do it
   */
  private checkMaintenance (): this {
    this.log('Checking maintenance...')

    if (Math.random() <= this.maintenanceChance / 100) {
      try {
        this.maintenance()
      } catch (e) {
        console.error('Failed to run maintenance.', e)
      }
    }

    return this
  }

  private maintenance (): this {
    this.log('Running maintenance...')

    const now = new Date()
    Object.keys(this.bufferedMessages).forEach(id => {
      const buffer = this.getBuffer(id)

      const diff = now.getTime() - buffer.lastActivity.getTime()
      const seconds = Math.abs(diff / 1000)

      if (seconds > BUFFER_RETENTION_PERIOD_SECONDS) {
        this.cleanBuffer(id)
      }
    })
    return this
  }

  private setTTL (ttl: any): this {
    if (!Number.isSafeInteger(ttl)) throw new Error('Invalid TTL: must be an integer')
    if (ttl < 1) throw new Error('Invalid TTL: must be greater than 0')
    this.ttl = ttl
    return this
  }

  private setMaintenanceChance (change: any): this {
    if (Number.isNaN(change)) throw new Error('Invalid maintenanceChance: must be numeric')
    if (change <= 0 || change > 100) throw new Error('Invalid maintenanceChance: must be greater than 0 and lower than 100')
    this.maintenanceChance = change
    return this
  }

  private log (arg: any): void {
    this.debug && console.log(arg)
  }
}

/** Options to configure the EventEmitter */
export interface BufferedEventEmitterOptions {
  /**
   * TimeToLive: Time in seconds that the buffer can exists without activity.
   * After this period it isn't valid anymore and can eventually be removed.
   *
   * Example: 10
   */
  ttl?: number

  /**
   * Every call to some methods will have a chance to run the maintenance, witch
   * is the process of remove expired buffers not flushed. This number define
   * the chance of this process happen on a method call (percent);
   * Example: 10 => 10% chance of running maintenance
   */
  maintenanceChance?: number
}

/**
 * The buffer
 */
export interface BufferedEventEmitterBuffer {
  /** Unique id of the buffer */
  id: number | String

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
  [propName: string | number]: BufferedEventEmitterBuffer
}

/**
 *
 */
export interface BufferedEventEmitterBufferEvents {
  [propName: string]: any[]
}
