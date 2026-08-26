import { useState, useCallback } from 'react'

/**
 * Hook for database API calls with loading and error state management.
 *
 * Usage:
 *   const { loading, error, callApi } = useDatabase()
 *   const data = await callApi(() => window.api.getLedgers())
 */
export function useDatabase() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const callApi = useCallback(async (apiFunction) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiFunction()
      return result
    } catch (err) {
      const message = err?.message || 'An unexpected error occurred'
      setError(message)
      console.error('[useDatabase] API Error:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return { loading, error, callApi, clearError }
}
