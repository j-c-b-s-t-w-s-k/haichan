import { beforeAll, afterEach, afterAll, vi } from 'vitest'

// Mock Web Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  
  postMessage(data: any) {
    // Simulate worker responses for testing
    if (data.type === 'start') {
      // Simulate mining start
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', {
            data: {
              type: 'progress',
              data: {
                hash: '21e8000000000000',
                nonce: 'test-nonce',
                points: 15,
                trailingZeros: 2,
                attempts: 100
              }
            }
          }))
        }
      }, 10)
    } else if (data.type === 'stop') {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', {
          data: { type: 'stopped' }
        }))
      }
    }
  }
  
  terminate() {
    // Cleanup
  }
}

// Global mocks
beforeAll(() => {
  // Mock Worker constructor
  global.Worker = MockWorker as any
  
  // Mock crypto.getRandomValues
  global.crypto = {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
      return array
    }
  } as any
  
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
  global.localStorage = localStorageMock as any
})

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks()
})

afterAll(() => {
  // Cleanup
})
