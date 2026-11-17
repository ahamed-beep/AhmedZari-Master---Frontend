// Data layer for the POS app.
// Backend (Node.js) REQUIRED — agar backend band ho to login nahi hoga
// aur app kaam nahi karega. Data MySQL se aata hai.
//
// Persistence ab granular REST endpoints (src/api.js) ke through hoti hai.
// localStorage sirf ek local CACHE hai (fast startup + load() reads ke liye),
// source of truth backend/MySQL hai.

import { api, getToken, API_BASE } from './api.js'

const PREFIX = 'pos_'

export { API_BASE }

// Check karo ke backend chal raha hai ya nahi
export async function checkBackend() {
  try {
    await api.health()
    return true
  } catch (e) {
    return false
  }
}

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch (e) {
    return fallback
  }
}

// Local cache write ONLY. (Pehle ye poora collection backend ko PUT karta tha;
// ab persistence granular API calls se hoti hai — components api.* call karte hain.)
export function save(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function money(n) {
  return 'Rs ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

// Backend se sab data lo aur localStorage cache update karo.
// Requires a valid token (login ke baad call hota hai).
export async function syncFromServer() {
  if (!getToken()) return false
  try {
    const data = await api.getBootstrap()
    Object.keys(data).forEach((key) => {
      localStorage.setItem(PREFIX + key, JSON.stringify(data[key]))
    })
    return true
  } catch (e) {
    // Expiry auto-logout ab api.js mein centrally handle hota hai (TOKEN_EXPIRED).
    // Baaki errors par cache jaisa hai waisa rehne dein — user logged-in rahega.
    return false
  }
}

export function initData() {
  if (!load('sales', null)) save('sales', [])
  if (!load('ledger', null)) save('ledger', [])
  if (!load('ledgerTx', null)) save('ledgerTx', [])
  if (!load('purchases', null)) save('purchases', [])
}
