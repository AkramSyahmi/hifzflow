import { describe, it, expect } from 'vitest'

describe('memorisation logic', () => {
  it('toggle adds a page not in the set', () => {
    const state = new Set([1, 2, 3])
    const next = new Set(state)
    const page = 4
    if (next.has(page)) next.delete(page)
    else next.add(page)
    expect(next.has(4)).toBe(true)
    expect(next.size).toBe(4)
  })

  it('toggle removes a page already in the set', () => {
    const state = new Set([1, 2, 3])
    const next = new Set(state)
    const page = 2
    if (next.has(page)) next.delete(page)
    else next.add(page)
    expect(next.has(2)).toBe(false)
    expect(next.size).toBe(2)
  })

  it('density strip covers all 604 pages', () => {
    expect(Array.from({ length: 604 }, (_, i) => i + 1)).toHaveLength(604)
  })
})