import { act } from '@testing-library/react'
import { afterEach } from 'vitest'
import * as zustand from 'zustand'

export const storeResetFns = new Set<() => void>()

// Intercept the create function to register reset callbacks.
// Zustand v5 uses double-call: create<T>()(stateCreator)
// The first call returns a function; the second call creates the store.
const { create: originalCreate } = zustand

const create = (<T,>() => {
  return (stateCreator: zustand.StateCreator<T>) => {
    const store = originalCreate<T>()(stateCreator)
    const initialState = store.getState()
    storeResetFns.add(() => store.setState(initialState as T, true))
    return store
  }
}) as typeof originalCreate

afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => resetFn())
  })
})

export { create }
export default create
