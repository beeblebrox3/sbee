module.exports = {
  entryPoints: ['./src/BufferedEventEmitter.ts'],
  out: './docs',

  name: 'sbee - Simple Buffered Event Emitter',
  includes: './src',
  exclude: [
    '**/*.test.ts'
  ],

  excludePrivate: true,
  excludeExternals: true
}
