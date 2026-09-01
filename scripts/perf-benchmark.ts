import { performance } from 'node:perf_hooks'

function measure(label: string, fn: () => void) {
  const start = performance.now()
  fn()
  const durationMs = performance.now() - start
  console.log(`${label}: ${durationMs.toFixed(2)}ms`)
  return durationMs
}

function run() {
  const iterations = 1000
  const sample = Array.from({ length: iterations }, (_, index) => index)

  const parseDuration = measure('Array iteration', () => {
    for (let index = 0; index < sample.length; index += 1) {
      sample[index] = sample[index] + 1
    }
  })

  const stringifyDuration = measure('JSON stringify', () => {
    JSON.stringify(sample)
  })

  const sortDuration = measure('Array sort', () => {
    [...sample].sort((a, b) => a - b)
  })

  console.log('---')
  console.log(`Target: page render under 4s, API response under 1.5s, benchmark iterations=${iterations}`)
  console.log(`Result: parse=${parseDuration.toFixed(2)}ms, stringify=${stringifyDuration.toFixed(2)}ms, sort=${sortDuration.toFixed(2)}ms`)
}

run()
