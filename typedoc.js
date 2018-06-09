module.exports = {
    out: './docs',
    includeDeclarations: true,

    name: "sbee - Simple Buffered Event Emitter",
    // readme: './readme.md',
    includes: './src',
    exclude: [
        '**/*.test.ts',
    ],

    mode: "file",


    excludePrivate: true,
    excludeExternals: true
};