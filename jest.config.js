module.exports = {
  roots: [
    '<rootDir>/src'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  moduleFileExtensions: [
    'ts',
    'js',
    'json',
    'node'
  ],
  collectCoverageFrom: [
    'src/BufferedEventEmitter.ts'
  ],
  collectCoverage: true
}
