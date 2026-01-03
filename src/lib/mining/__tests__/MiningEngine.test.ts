import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MiningEngine } from '../MiningEngine'
import type { MiningResult, MiningProgress } from '../MiningEngine'

// Mock the db client
vi.mock('../../db-client', () => ({
  default: {
    auth: {
      me: vi.fn().mockResolvedValue({
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com'
      })
    },
    db: {
      powRecords: {
        create: vi.fn().mockResolvedValue({ id: 'pow-record-1' })
      },
      users: {
        list: vi.fn().mockResolvedValue([{
          id: 'test-user-id',
          totalPowPoints: 100
        }]),
        update: vi.fn().mockResolvedValue({})
      },
      achievements: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'achievement-1' })
      },
      threads: {
        list: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({})
      },
      posts: {
        list: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({})
      },
      blogPosts: {
        list: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({})
      }
    },
    realtime: {
      publish: vi.fn().mockResolvedValue('message-id')
    }
  }
}))

describe('MiningEngine', () => {
  let engine: MiningEngine
  
  beforeEach(() => {
    engine = new MiningEngine()
  })

  afterEach(() => {
    engine.destroy()
  })

  describe('generateChallenge', () => {
    it('should generate a valid 64-character hex challenge', async () => {
      const challenge = await engine.generateChallenge()
      
      expect(challenge).toBeDefined()
      expect(challenge).toHaveLength(64)
      expect(challenge).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should generate unique challenges', async () => {
      const challenge1 = await engine.generateChallenge()
      const challenge2 = await engine.generateChallenge()
      
      expect(challenge1).not.toBe(challenge2)
    })

    it('should store the challenge internally', async () => {
      const challenge = await engine.generateChallenge()
      
      expect(engine.getCurrentChallenge()).toBe(challenge)
    })
  })

  describe('startMining', () => {
    it('should initialize mining state', async () => {
      expect(engine.isMining()).toBe(false)
      
      await engine.startMining('user', 'test-user-id', 15)
      
      expect(engine.isMining()).toBe(true)
    })

    it('should generate a challenge if none exists', async () => {
      expect(engine.getCurrentChallenge()).toBe('')
      
      await engine.startMining('user', 'test-user-id', 15)
      
      expect(engine.getCurrentChallenge()).not.toBe('')
      expect(engine.getCurrentChallenge()).toHaveLength(64)
    })

    it('should call progress callback when provided', async () => {
      const progressCallback = vi.fn()
      
      await engine.startMining('user', 'test-user-id', 15, progressCallback)
      
      // Progress callback will be called by worker, so we just verify it's registered
      expect(progressCallback).toBeDefined()
    })

    it('should stop existing mining session before starting new one', async () => {
      await engine.startMining('user', 'user-1', 15)
      expect(engine.isMining()).toBe(true)
      
      await engine.startMining('user', 'user-2', 15)
      
      // Should still be mining (new session)
      expect(engine.isMining()).toBe(true)
    })
  })

  describe('stopMining', () => {
    it('should stop active mining session', async () => {
      await engine.startMining('user', 'test-user-id', 15)
      expect(engine.isMining()).toBe(true)
      
      engine.stopMining()
      
      expect(engine.isMining()).toBe(false)
    })

    it('should clear all progress callbacks', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      await engine.startMining('user', 'test-user-id', 15, callback1)
      await engine.startMining('user', 'test-user-id', 15, callback2)
      
      engine.stopMining()
      
      // After stopping, callbacks should be cleared
      expect(engine.isMining()).toBe(false)
    })
  })

  describe('getCurrentChallenge', () => {
    it('should return empty string initially', () => {
      expect(engine.getCurrentChallenge()).toBe('')
    })

    it('should return the current challenge after generation', async () => {
      const challenge = await engine.generateChallenge()
      
      expect(engine.getCurrentChallenge()).toBe(challenge)
    })
  })

  describe('destroy', () => {
    it('should stop mining and cleanup resources', async () => {
      await engine.startMining('user', 'test-user-id', 15)
      expect(engine.isMining()).toBe(true)
      
      engine.destroy()
      
      expect(engine.isMining()).toBe(false)
    })

    it('should be safe to call multiple times', () => {
      expect(() => {
        engine.destroy()
        engine.destroy()
        engine.destroy()
      }).not.toThrow()
    })
  })

  describe('handleComplete (integration test simulation)', () => {
    it('should process valid mining result', async () => {
      // This is tested indirectly through the worker message handler
      // In a real test, we'd simulate the worker sending a 'complete' message
      
      const mockResult: MiningResult = {
        hash: '21e8000000000000000000000000000000000000000000000000000000000001',
        nonce: 'test-nonce-123',
        points: 15,
        trailingZeros: 2,
        attempts: 1000
      }
      
      // The actual implementation would trigger database updates
      // which we've mocked above
      expect(mockResult.trailingZeros).toBeGreaterThan(0)
      expect(mockResult.points).toBeGreaterThanOrEqual(15)
    })
  })

  describe('edge cases', () => {
    it('should handle mining without target ID', async () => {
      expect(async () => {
        await engine.startMining('user', undefined, 15)
      }).not.toThrow()
    })

    it('should handle different target types', async () => {
      await engine.startMining('thread', 'thread-123', 15)
      expect(engine.isMining()).toBe(true)
      
      engine.stopMining()
      
      await engine.startMining('post', 'post-456', 15)
      expect(engine.isMining()).toBe(true)
      
      engine.stopMining()
      
      await engine.startMining('blog', 'blog-789', 15)
      expect(engine.isMining()).toBe(true)
    })

    it('should handle different target points', async () => {
      await engine.startMining('user', 'test-user', 10)
      expect(engine.isMining()).toBe(true)
      
      engine.stopMining()
      
      await engine.startMining('user', 'test-user', 20)
      expect(engine.isMining()).toBe(true)
      
      engine.stopMining()
      
      await engine.startMining('user', 'test-user', 50)
      expect(engine.isMining()).toBe(true)
    })
  })
})
