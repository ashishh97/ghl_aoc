import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

http.interceptors.response.use(
  r => r.data,
  err => {
    const msg = err.response?.data?.error?.message ?? err.message ?? 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

// ── Agents ─────────────────────────────────────────────────────────────────
export const api = {
  agents: {
    list:      ()           => http.get('/agents'),
    get:       (id)         => http.get(`/agents/${id}`),
    create:    (body)       => http.post('/agents', body),
    update:    (id, body)   => http.patch(`/agents/${id}`, body),
    delete:    (id)         => http.delete(`/agents/${id}`),
    kpis: {
      list:    (agentId)              => http.get(`/agents/${agentId}/kpis`),
      create:  (agentId, body)        => http.post(`/agents/${agentId}/kpis`, body),
      update:  (agentId, kpiId, body) => http.patch(`/agents/${agentId}/kpis/${kpiId}`, body),
      delete:  (agentId, kpiId)       => http.delete(`/agents/${agentId}/kpis/${kpiId}`)
    }
  },
  transcripts: {
    list:      (params)     => http.get('/transcripts', { params }),
    get:       (id)         => http.get(`/transcripts/${id}`),
    create:    (body)       => http.post('/transcripts', body),
    sync:      (body)       => http.post('/transcripts/sync', body),
    delete:    (id)         => http.delete(`/transcripts/${id}`)
  },
  analyze: {
    dashboard: ()           => http.get('/analyze/dashboard'),
    evaluateCall:  (id, force = false) => http.post(`/analyze/call/${id}`, { force }),
    getEvaluation: (id)     => http.get(`/analyze/call/${id}`),
    evaluateAgent: (agentId)=> http.post(`/analyze/agent/${agentId}`)
  }
}
