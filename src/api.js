// ------------------------------------------------------------------
// HTTP client for the AgroPoint Node backend.
// Handles the base URL, JWT storage, auth-header injection, JSON
// parsing and error handling. One method per endpoint.
// ------------------------------------------------------------------

// Point this at your backend. Override at runtime with window.__POS_API__.
// export const API_BASE = 'http://localhost:8000/api'
export const API_BASE = 'https://ahmadzaricorporation.com/api'

const TOKEN_KEY = 'pos_token'
const USER_KEY = 'pos_user'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// The authenticated user is cached alongside the token so the session
// survives a page refresh without needing to hit the server for identity.
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
export function setUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore quota / private-mode errors */
  }
}
export function clearUser() {
  localStorage.removeItem(USER_KEY)
}

// The app registers a callback here so an expired token can force a logout
// from anywhere (any endpoint), not just the login flow.
let onAuthExpired = null
export function setOnAuthExpired(fn) {
  onAuthExpired = fn
}

// Thrown for HTTP errors so callers can inspect status/code (e.g. 401 -> re-login).
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request(method, path, body, { timeout } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  })

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`
    const code = data && data.code
    // A genuinely EXPIRED token is the only thing that force-logs-out the
    // user. Other 401s (e.g. transient / malformed) leave the session intact.
    if (res.status === 401 && code === 'TOKEN_EXPIRED') {
      clearToken()
      clearUser()
      if (onAuthExpired) onAuthExpired()
    }
    throw new ApiError(msg, res.status, code)
  }
  return data
}

// Query string from a plain object, dropping empty/undefined values so we don't
// send `?q=&from=` noise. Values are URL-encoded.
function qs(params) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  })
  return sp.toString()
}

export const api = {
  // ---- Public ----
  health: () => request('GET', '/health', undefined, { timeout: 5000 }),
  login: (username, password) => request('POST', '/login', { username, password }, { timeout: 8000 }),

  // ---- Bootstrap read ----
  getBootstrap: () => request('GET', '/data', undefined, { timeout: 8000 }),

  // ---- Products ----
  createProduct: (product) => request('POST', '/products', product),
  updateProduct: (id, product) => request('PUT', `/products/${id}`, product),
  deleteProduct: (id) => request('DELETE', `/products/${id}`),

  // ---- Employees ----
  createEmployee: (emp) => request('POST', '/employees', emp),
  updateEmployee: (id, emp) => request('PUT', `/employees/${id}`, emp),
  deleteEmployee: (id) => request('DELETE', `/employees/${id}`),

  // ---- Customers (ledger) ----
  // Server-side paged + searched directory: { items, total, page, pageSize,
  // toReceive, toGive }. The two totals span ALL customers, not just the page.
  listCustomers: ({ q = '', page = 1, pageSize = 10 } = {}) =>
    request('GET', `/customers?${qs({ q, page, pageSize })}`),
  createCustomer: (customer) => request('POST', '/customers', customer),
  // Profile only — name/phone. Balance moves via addLedgerTx, never here.
  updateCustomer: (id, fields) => request('PUT', `/customers/${id}`, fields),
  deleteCustomer: (id) => request('DELETE', `/customers/${id}`),

  // ---- Ledger transactions ----
  // Newest first, each entry carrying customerName/customerPhone.
  // `all: true` ignores paging and returns every match (for the PDF export).
  listLedgerTx: ({ q = '', from = '', to = '', page = 1, pageSize = 50, all = false } = {}) =>
    request('GET', `/ledger-tx?${qs(all ? { q, from, to, all: 1 } : { q, from, to, page, pageSize })}`),
  addLedgerTx: (tx) => request('POST', '/ledger-tx', tx),

  // ---- Sales (transactional checkout) ----
  createSale: (sale) => request('POST', '/sales', sale),

  // ---- Returns (transactional refund against a sale) ----
  createReturn: (ret) => request('POST', '/returns', ret),

  // ---- Purchases (transactional stock-in) ----
  createPurchase: (purchase) => request('POST', '/purchases', purchase),

  // ---- Settings ----
  saveSettings: (value) => request('PUT', '/settings', { value }),
}
