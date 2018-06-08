declare class BufferedEventEmitter {
    private debug;
    private map;
    private bufferedMessages;
    private ttl;
    private maintenanceChanve;
    static FLUSH_BUFFER_EVENT_NAME: string;
    static CLEAN_BUFFER_EVENT_NAME: string;
    constructor(options: BufferedEventEmitterOptions);
    private log;
    debugEnable(value: boolean): void;
    createBuffer(bufferId: number | string, context: any): void;
    emitBuffered(bufferId: number | string, eventName: string, message: any): void;
    flush(bufferId: string | number): boolean;
    cleanBuffer(bufferId: number | string): boolean;
    subscribe(eventName: string, fn: Function): Function;
    subscribeMultiple(eventNames: string[], fn: Function): Function;
    unsubscribe(eventName: string, fn: Function): void;
    unsubscribeMultiple(eventNames: string[], fn: Function): void;
    unsubscribeAll(eventNames: string[]): void;
    emit(eventName: string, ...args: any[]): void;
    private validateBufferExists;
    private getBuffer;
    private checkMaintenance;
    private maintenance;
}
export default BufferedEventEmitter;
