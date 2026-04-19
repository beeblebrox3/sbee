import { describe, expect, it, vi } from "vitest";
import {
  BufferedEventEmitter,
  CLEAN_BUFFER_EVENT_NAME,
  ERR_BUFFER_ALREADY_EXISTS,
  ERR_BUFFER_NOT_FOUND,
  FLUSH_BUFFER_EVENT_NAME,
} from "./BufferedEventEmitter.js";

const EVENT_NAME = "my-event";
const BUFFER_ID = "buffer-id";

async function sleep(ms: number) {
  return await new Promise(resolve => setTimeout(resolve, ms));
}

describe("Regular event emitter", () => {
  it("should call handler when event is emitted", () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();

    instance.subscribe(EVENT_NAME, handler);
    instance.emit(EVENT_NAME, "event-data");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("event-data");
  });

  it("should call multiple handlers when event is emitted", () => {
    const instance = new BufferedEventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    instance.subscribe(EVENT_NAME, handler1);
    instance.subscribe(EVENT_NAME, handler2);
    instance.emit(EVENT_NAME, "event-data");

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledWith("event-data");
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledWith("event-data");
  });

  it("should freeze event data passed to handler", () => {
    const instance = new BufferedEventEmitter();

    const original = { foo: "bar" };

    const handler = vi.fn((data: { foo: string }) => {
      data.foo = "mutated";
    });

    instance.subscribe(EVENT_NAME, handler);
    instance.emit(EVENT_NAME, original);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(original).toStrictEqual({ foo: "bar" });
  });

  it("should call handler with scalar values", () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();

    instance.subscribe(EVENT_NAME, handler);
    instance.emit(EVENT_NAME, 42);
    instance.emit(EVENT_NAME, "string-data");
    instance.emit(EVENT_NAME, true);

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, 42);
    expect(handler).toHaveBeenNthCalledWith(2, "string-data");
    expect(handler).toHaveBeenNthCalledWith(3, true);
  });

  it("should call handler with objects", () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();
    const data = { foo: "bar", baz: 1 };

    instance.subscribe(EVENT_NAME, handler);
    instance.emit(EVENT_NAME, data);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(data);
  });

  it("should call handler with multiple arguments", () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();

    instance.subscribe(EVENT_NAME, handler);
    instance.emit(EVENT_NAME, "first", "second", "third");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("first", "second", "third");
  });

  it("should call handler without any argument", () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();

    instance.subscribe(EVENT_NAME, handler);
    instance.emit(EVENT_NAME);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith();
  });

  it.each`
    value       | reason
    ${""}       | ${"empty string"}
    ${null}     | ${"null"}
    ${1}        | ${"number"}
    ${[1]}      | ${"array"}
    ${{ a: 1 }} | ${"object"}
  `("should reject invalid event name: $reason", ({ value }) => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();

    expect(() => instance.subscribe(value, handler)).toThrow();
  });

  describe("unsubscribe", () => {
    it("should unsubscribe all", () => {
      const instance = new BufferedEventEmitter({});

      const handlerFoo1 = vi.fn();
      const handlerFoo2 = vi.fn();
      const handlerBar = vi.fn();
      const handlerBaz = vi.fn();

      instance.subscribe("foo", handlerFoo1);
      instance.subscribe("foo", handlerFoo2);
      instance.subscribe("bar", handlerBar);
      instance.subscribe("baz", handlerBaz);

      instance.unsubscribeAll(["foo", "bar"]);

      instance.emit("foo", "a");
      instance.emit("bar", "b");
      instance.emit("baz", "c");

      expect(handlerFoo1).not.toHaveBeenCalled();
      expect(handlerFoo2).not.toHaveBeenCalled();
      expect(handlerBar).not.toHaveBeenCalled();
      expect(handlerBaz).toHaveBeenCalledWith("c");

      expect(() => instance.unsubscribeAll(["nonexistent"])).not.toThrow();
    });
  });
});

describe("Buffered", () => {
  it("should create buffer with custom id", () => {
    const instance = new BufferedEventEmitter();
    const buffer = instance.createBuffer(BUFFER_ID);

    expect(buffer.bufferId).toBe(BUFFER_ID);
  });

  it("should generate buffer id if not provided", () => {
    const instance = new BufferedEventEmitter();
    const buffer = instance.createBuffer();

    expect(buffer.bufferId).toBeDefined();
  });

  it("should emit only after flush using buffere emit method", async () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();
    instance.subscribe(EVENT_NAME, handler);

    const buffer = instance.createBuffer(BUFFER_ID);
    buffer.emit(EVENT_NAME, "event-data");
    expect(handler).not.toHaveBeenCalled();

    buffer.flush();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("event-data");
  });

  it("should emit only after flush using emitBuffered method", async () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();
    instance.subscribe(EVENT_NAME, handler);

    const buffer = instance.createBuffer(BUFFER_ID);
    instance.emitBuffered(BUFFER_ID, EVENT_NAME, "event-data");
    expect(handler).not.toHaveBeenCalled();

    buffer.flush();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("event-data");
  });

  it("should emit using created buffer response without requiring buffer id", () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();
    instance.subscribe(EVENT_NAME, handler);

    const buffer = instance.createBuffer(BUFFER_ID);
    buffer.emit(EVENT_NAME, "event-data");
    buffer.flush();
    expect(handler).toHaveBeenCalledWith("event-data");
  });

  it("should emit using emitBuffered with buffer id", () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();
    instance.subscribe(EVENT_NAME, handler);

    const buffer = instance.createBuffer(BUFFER_ID);
    instance.emitBuffered(BUFFER_ID, EVENT_NAME, "event-data");
    buffer.flush();
    expect(handler).toHaveBeenCalledWith("event-data");
  });

  it("should throw emitting buffered with invalid buffer id", () => {
    const instance = new BufferedEventEmitter();

    expect(() => instance.emitBuffered(BUFFER_ID, EVENT_NAME)).toThrow(
      ERR_BUFFER_NOT_FOUND
    );
  });

  it("should clear without emitting", () => {
    const instance = new BufferedEventEmitter();
    const handler = vi.fn();
    instance.subscribe(EVENT_NAME, handler);

    const buffer = instance.createBuffer(BUFFER_ID);
    buffer.emit(EVENT_NAME, "event-data");
    buffer.clean();
    expect(handler).not.toHaveBeenCalled();
  });

  it("should not create buffer with existing id", () => {
    const instance = new BufferedEventEmitter({});
    const bufferId = "buffer-xpto";

    instance.createBuffer(bufferId);

    expect(() => instance.createBuffer(bufferId)).toThrow(
      ERR_BUFFER_ALREADY_EXISTS
    );
  });

  describe("flush", () => {
    it("should call buffer flush event handler with buffer id, context and all events", () => {
      const instance = new BufferedEventEmitter();
      const handler = vi.fn();

      instance.subscribe(FLUSH_BUFFER_EVENT_NAME, handler);

      const buffer = instance.createBuffer(BUFFER_ID, { myContext: 123 });

      buffer.emit(EVENT_NAME, "event-data-1");
      buffer.emit(EVENT_NAME, "event-data-2");
      buffer.flush();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        BUFFER_ID,
        { myContext: 123 },
        {
          [EVENT_NAME]: [["event-data-1"], ["event-data-2"]],
        }
      );
    });

    it("should call buffer flush event handler with multiple events", () => {
      const instance = new BufferedEventEmitter();
      const handler = vi.fn();

      instance.subscribe(FLUSH_BUFFER_EVENT_NAME, handler);

      const buffer = instance.createBuffer(BUFFER_ID, { myContext: 123 });

      buffer.emit("event1", "event1-data-1");
      buffer.emit("event1", "event1-data-2");
      buffer.emit("event2", "event2-data-1");
      buffer.emit("event2", "event2-data-2");

      buffer.flush();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        BUFFER_ID,
        { myContext: 123 },
        {
          event1: [["event1-data-1"], ["event1-data-2"]],
          event2: [["event2-data-1"], ["event2-data-2"]],
        }
      );
    });

    it("shoud work with multiple buffers at the same time", () => {
      const instance = new BufferedEventEmitter({});
      const handler = vi.fn();

      instance.subscribe(FLUSH_BUFFER_EVENT_NAME, handler);
      instance.createBuffer(1, "buffer 1");
      instance.createBuffer(2, "buffer 2");

      instance.emitBuffered(1, "foo", 11);
      instance.emitBuffered(1, "bar", 12);
      instance.emitBuffered(2, "foo", 21);

      instance.flush(1);
      instance.flush(2);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, 1, "buffer 1", {
        foo: [[11]],
        bar: [[12]],
      });
      expect(handler).toHaveBeenNthCalledWith(2, 2, "buffer 2", {
        foo: [[21]],
      });
    });

    it("should throw if buffer doesnt exists", () => {
      const instance = new BufferedEventEmitter();
      expect(() => instance.flush(BUFFER_ID)).toThrow(ERR_BUFFER_NOT_FOUND);
    });
  });

  describe("clean", () => {
    it("should call buffer clean event handler with buffer id, context and all events", () => {
      const instance = new BufferedEventEmitter();
      const handler = vi.fn();

      instance.subscribe(CLEAN_BUFFER_EVENT_NAME, handler);

      const buffer = instance.createBuffer(BUFFER_ID, { myContext: 123 });

      buffer.emit(EVENT_NAME, "event-data-1");
      buffer.emit(EVENT_NAME, "event-data-2");
      buffer.clean();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        BUFFER_ID,
        { myContext: 123 },
        {
          [EVENT_NAME]: [["event-data-1"], ["event-data-2"]],
        }
      );
    });

    it("should call buffer clean event handler with multiple events", () => {
      const instance = new BufferedEventEmitter();
      const handler = vi.fn();

      instance.subscribe(CLEAN_BUFFER_EVENT_NAME, handler);

      const buffer = instance.createBuffer(BUFFER_ID, { myContext: 123 });

      buffer.emit("event1", "event1-data-1");
      buffer.emit("event1", "event1-data-2");
      buffer.emit("event2", "event2-data-1");
      buffer.emit("event2", "event2-data-2");

      buffer.clean();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        BUFFER_ID,
        { myContext: 123 },
        {
          event1: [["event1-data-1"], ["event1-data-2"]],
          event2: [["event2-data-1"], ["event2-data-2"]],
        }
      );
    });

    it("shoud work with multiple buffers at the same time", () => {
      const instance = new BufferedEventEmitter({});
      const handler = vi.fn();

      instance.subscribe(CLEAN_BUFFER_EVENT_NAME, handler);
      instance.createBuffer(1, "buffer 1");
      instance.createBuffer(2, "buffer 2");

      instance.emitBuffered(1, "foo", 11);
      instance.emitBuffered(1, "bar", 12);
      instance.emitBuffered(2, "foo", 21);

      instance.cleanBuffer(1);
      instance.cleanBuffer(2);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, 1, "buffer 1", {
        foo: [[11]],
        bar: [[12]],
      });
      expect(handler).toHaveBeenNthCalledWith(2, 2, "buffer 2", {
        foo: [[21]],
      });
    });

    it("should throw if buffer doesnt exists", () => {
      const instance = new BufferedEventEmitter();
      expect(() => instance.cleanBuffer(BUFFER_ID)).toThrow(
        ERR_BUFFER_NOT_FOUND
      );
    });
  });
});

describe("maintenance", () => {
  it("maintenance should clean old buffers", async () => {
    const instance = new BufferedEventEmitter({ ttl: 1 });
    const id = "buffer1";
    const handler = vi.fn();

    instance.subscribe("foo", handler);
    instance.createBuffer(id, { name: "Buffer 1" });
    instance.emitBuffered(id, "foo", 1);

    await sleep(2000);

    // biome-ignore lint/complexity/useLiteralKeys: this is not a public method, but we can call it directly for testing purposes
    instance["maintenance"]();

    expect(() => instance.flush(id)).toThrow("BUFFER NOT FOUND");
    expect(handler.mock.calls.length).toBe(0);
  });

  it("maintenance should clean only buffers older than TTL", async () => {
    const instance = new BufferedEventEmitter({ ttl: 3 });
    const id = "buffer1";
    instance.createBuffer(id);

    await sleep(1500);

    // biome-ignore lint/complexity/useLiteralKeys: this is not a public method, but we can call it directly for testing purposes
    instance["maintenance"]();
    expect(instance.bufferExists(id)).toBe(true);

    await sleep(3000);

    // biome-ignore lint/complexity/useLiteralKeys: this is not a public method, but we can call it directly for testing purposes
    instance["maintenance"]();
    expect(instance.bufferExists(id)).toBe(false);
  });
});

it("should enable debug log", () => {
  const spy = vi.spyOn(console, "log");

  const instance = new BufferedEventEmitter();
  instance.createBuffer("buffer1");
  expect(spy).not.toHaveBeenCalled();

  instance.setDebugMode(true);
  instance.createBuffer("buffer2");
  expect(spy).toHaveBeenCalled();
});

it("getBuffer should return a copy of the buffer and prevent changes on the original buffer", () => {
  const instance = new BufferedEventEmitter();
  const context = { name: "Buffer 1" };
  instance.createBuffer("buffer1", context);

  const buffer = instance.getBuffer("buffer1");
  expect(buffer.context).toEqual(context);

  // @ts-expect-error testing only
  buffer.context.newProp = "newValue";
  expect(instance.getBuffer("buffer1").context).toEqual(context);
});
