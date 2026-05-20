import { ref } from 'vue'

export function useAsync() {
  const loading = ref(false)
  const error   = ref(null)

  async function run(fn) {
    loading.value = true
    error.value   = null
    try {
      return await fn()
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  return { loading, error, run }
}
