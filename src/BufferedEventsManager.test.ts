/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { vi, test, expect } from 'vitest'
import { BufferedEventEmitter } from './BufferedEventEmitter'

async function sleep (ms: number) {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

test('flush event', () => {
  const instance = new BufferedEventEmitter({})
  const id = 'buffer1'

  const handler = vi.fn()
  instance.subscribe('BUFFER:flush', handler)

  instance.createBuffer(id, { name: 'Buffer 1' })
  instance.emitBuffered(id, 'foo', { event: 'foo' })
  instance.emitBuffered(id, 'foo', { event: 'bar' })
  instance.flush(id)

  expect(handler.mock.calls.length).toBe(1)
  expect(handler.mock.calls[0][0]).toBe(id)
  expect(handler.mock.calls[0][1]).toMatchObject({ name: 'Buffer 1' })
  expect(handler.mock.calls[0][2]).toMatchObject({ foo: [[{ event: 'foo' }], [{ event: 'bar' }]] })
})

test('clean event', () => {
  const instance = new BufferedEventEmitter({})
  const id = 'buffer1'

  const handler = vi.fn()
  instance.subscribe('BUFFER:clean', handler)

  instance.createBuffer(id, { name: 'Buffer 1' })
  instance.emitBuffered(id, 'foo', { event: 'foo' })
  instance.emitBuffered(id, 'foo', { event: 'bar' })
  instance.cleanBuffer(id)

  expect(handler.mock.calls.length).toBe(1)
  expect(handler.mock.calls[0][0]).toBe(id)
  expect(handler.mock.calls[0][1]).toMatchObject({ name: 'Buffer 1' })
  expect(handler.mock.calls[0][2]).toMatchObject({ foo: [[{ event: 'foo' }], [{ event: 'bar' }]] })
})

test('shoud call all messages events on flush', () => {
  const instance = new BufferedEventEmitter({})
  const id = 'buffer1'
  const context = { name: 'Buffer 1' }

  const handlerEvents = vi.fn()
  const handlerFlush = vi.fn()

  instance.subscribe(BufferedEventEmitter.FLUSH_BUFFER_EVENT_NAME, handlerFlush)

  instance.subscribe('foo', handlerEvents)
  instance.subscribe('bar', handlerEvents)
  instance.subscribeMultiple(['zoo', 'poo'], handlerEvents)

  instance.createBuffer(id, context)
  instance.emitBuffered(id, 'foo', 1)
  instance.emitBuffered(id, 'bar', 2)
  instance.emitBuffered(id, 'zoo', 3)
  instance.emitBuffered(id, 'poo', 4)

  instance.flush(id)

  expect(handlerEvents.mock.calls.length).toBe(4)
  expect(handlerEvents.mock.calls[0][0]).toBe(1)
  expect(handlerEvents.mock.calls[1][0]).toBe(2)
  expect(handlerEvents.mock.calls[2][0]).toBe(3)
  expect(handlerEvents.mock.calls[3][0]).toBe(4)

  expect(handlerFlush.mock.calls.length).toBe(1)
  expect(handlerFlush.mock.calls[0][0]).toBe(id)
  expect(handlerFlush.mock.calls[0][1]).toMatchObject(context)
  expect(handlerFlush.mock.calls[0][2]).toMatchObject({
    foo: [[1, context]],
    bar: [[2, context]],
    zoo: [[3, context]],
    poo: [[4, context]]
  })
})

test('maintenance should clean old buffers', async () => {
  const instance = new BufferedEventEmitter({ ttl: 1 })
  const id = 'buffer1'
  const handler = vi.fn()

  instance.subscribe('foo', handler)
  instance.createBuffer(id, { name: 'Buffer 1' })
  instance.emitBuffered(id, 'foo', 1)

  await sleep(2000)

  // eslint-disable-next-line @typescript-eslint/dot-notation
  instance['maintenance']()
  expect(() => instance.flush(id)).toThrow('BUFFER NOT FOUND')
  expect(handler.mock.calls.length).toBe(0)
})

test('maintenance should clean only buffers older than TTL', async () => {
  const instance = new BufferedEventEmitter({ ttl: 3 })
  const id = 'buffer1'
  instance.createBuffer(id)

  await sleep(1500)
  // eslint-disable-next-line @typescript-eslint/dot-notation
  instance['maintenance']()
  expect(instance.bufferExists(id)).toBe(true)

  await sleep(3000)
  // eslint-disable-next-line @typescript-eslint/dot-notation
  instance['maintenance']()
  expect(instance.bufferExists(id)).toBe(false)
})

test('shoud work with multiple buffers', () => {
  const instance = new BufferedEventEmitter({})
  const handler = vi.fn()

  instance.subscribe('BUFFER:flush', handler)
  instance.createBuffer(1, 'buffer 1')
  instance.createBuffer(2, 'buffer 2')

  instance.emitBuffered(1, 'foo', 11)
  instance.emitBuffered(1, 'bar', 12)
  instance.emitBuffered(2, 'foo', 21)

  instance.flush(1)
  instance.flush(2)

  expect(handler.mock.calls.length).toBe(2)
  expect(handler.mock.calls[0][0]).toBe(1)
  expect(handler.mock.calls[0][1]).toBe('buffer 1')
  expect(handler.mock.calls[0][2]).toMatchObject({ foo: [[11]], bar: [[12]] })

  expect(handler.mock.calls[1][0]).toBe(2)
  expect(handler.mock.calls[1][1]).toBe('buffer 2')
  expect(handler.mock.calls[1][2]).toMatchObject({ foo: [[21]] })
})

test('should validate inexistent buffer calls', () => {
  const instance = new BufferedEventEmitter({})

  expect(() => instance.emitBuffered(1, 'foo', 'bar')).toThrow('BUFFER NOT FOUND')
  expect(() => instance.flush(1)).toThrow('BUFFER NOT FOUND')
  expect(() => instance.cleanBuffer(1)).toThrow('BUFFER NOT FOUND')
})

test('subscribe/unsubscribe', () => {
  const instance = new BufferedEventEmitter({})

  const handler = vi.fn()

  const dispose = instance.subscribe('foo', handler)
  instance.emit('foo', 'bar')
  dispose()
  instance.emit('foo', 'bar2')

  expect(handler.mock.calls.length).toBe(1)
})

test('subscribe/unsubscribe multiple', () => {
  const instance = new BufferedEventEmitter({})

  const handler = vi.fn()
  const handler2 = vi.fn()

  const dispose = instance.subscribeMultiple(['foo', 'bar'], handler)
  instance.emit('foo', 'bar')
  instance.emit('bar', 'foo')
  dispose()
  instance.emit('foo', 'bar1')
  instance.emit('bar', 'foo2')

  instance.subscribeMultiple(['a', 'b'], handler2)
  instance.emit('a', 'a')
  instance.unsubscribeMultiple(['a', 'b'], handler2)
  instance.emit('a', 'a')
  instance.emit('b', 'b')

  expect(handler.mock.calls.length).toBe(2)
  expect(handler2.mock.calls.length).toBe(1)
})

test('should not create buffer with existing id', () => {
  const instance = new BufferedEventEmitter({})
  const bufferId = 'buffer-xpto'

  instance.createBuffer(bufferId)

  expect(() => instance.createBuffer(bufferId)).toThrow('BUFFER ALREADY EXISTS')
})

test('event name must be a non empty string on subscribe', () => {
  const instance = new BufferedEventEmitter()
  const handler = vi.fn()

  expect(() => instance.subscribe('', handler)).toThrow('eventName cannot be empty')
})

test('enable debug logging', () => {
  const spy = vi.spyOn(console, 'log')

  const instance = new BufferedEventEmitter()
  instance.createBuffer('buffer1')
  expect(spy).not.toHaveBeenCalled()

  instance.setDebugMode(true)
  instance.createBuffer('buffer2')
  expect(spy).toHaveBeenCalled()
})
