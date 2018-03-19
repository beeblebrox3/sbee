# sbee - Simple Buffered Event Emitter

[![Build Status](https://travis-ci.org/beeblebrox3/sbee.svg?branch=master)](https://travis-ci.org/beeblebrox3/sbee)

> WIP

This project is a simple implementation of a event emitter, but with one particularity: you can create buffers to only emit the events when some condition occurs.
Like a relational database transaction, but for events. Like this:


```javascript
const ee = require("sbee");

// Create an instance of the event emiter
const instance = new ee();

// Now you can register handlers to your events:
// Every event of the type "the-event" will call this function.
// If the event is emitted inside a buffer, those calls will only be made when the buffer is flushed
instance.subscribe("the-event", data => console.log(data));


// You can emit an event to call the handler right away:
instance.emit("the-event", 1); // will call the handler and log 1 on the console

// Or you can do it inside a buffer
// Create your buffer
// Context is some information that you may need to know on your handlers.
// The name of the buffer must be unique. You can use a uniqid, for example, but you need to keep track of it
instance.createBuffer("my buffer", {my: "context"});

// Now you emit the event inside the buffer
instance.emitBuffered("my buffer", "the-event", {the: "data"});
// Another one, maybe
instance.emitBuffered("my buffer", "the-event", {the: "data2"});

// You need to flush to "really" emit all those events from the buffer
instance.flush("my buffer"); // wil lcal the handler 2 times, cause we emitted 2 events

// You can delete all the events too
instance.cleanBuffer("my buffer");
```

