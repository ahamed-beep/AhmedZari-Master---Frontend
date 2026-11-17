import React, { useEffect, useState } from 'react'
import { Layout, Drawer, Button, Spin, Result, Grid, Typography, App as AntdApp } from 'antd'
import { MenuOutlined, ReloadOutlined } from '@ant-design/icons'
import { initData, load, syncFromServer, checkBackend } from './db.js'
import { clearToken, clearUser, getToken, getUser, setUser as persistUser, setOnAuthExpired } from './api.js'
import { brand } from './theme.js'
import Login from './components/Login.jsx'
import SideNav from './components/Sidebar.jsx'
import SaleScreen from './components/SaleScreen.jsx'
import ProductsScreen from './components/ProductsScreen.jsx'
import EmployeesScreen from './components/EmployeesScreen.jsx'
import LedgerScreen from './components/LedgerScreen.jsx'
import HistoryScreen from './components/HistoryScreen.jsx'
import SettingsScreen from './components/SettingsScreen.jsx'
import ReportsScreen from './components/ReportsScreen.jsx'
import PrintBill from './components/PrintBill.jsx'

const { Sider, Header, Content } = Layout

const PAGE_TITLES = {
  sale: 'Sale Screen',
  products: 'Products Management',
  employees: 'Employees Management',
  ledger: 'Ledger / Customer Accounts',
  history: 'Sales History',
  reports: 'Reports — Profit & Purchases',
  settings: 'Settings',
}

const SIDER_WIDTH = 248

export default function App() {
  const { message } = AntdApp.useApp()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.lg

  const [ready, setReady] = useState(false)
  const [backendOk, setBackendOk] = useState(null) // null=checking, true=ok, false=down

  useEffect(() => {
    // An expired token (reported by any endpoint) is the only thing that
    // ends the session automatically — everything else keeps the user in.
    setOnAuthExpired(() => {
      setUser(null)
      message.warning('Session khatam ho gayi — dobara login karein')
    })

    async function init() {
      const ok = await checkBackend()
      setBackendOk(ok)
      // Already logged in from a previous visit? Refresh the cache and go.
      if (ok && getToken() && getUser()) {
        await syncFromServer()
        refreshFromCache()
      }
      setReady(true)
    }
    init()
  }, [])

  function refreshFromCache() {
    setProducts(load('products', []))
    setEmployees(load('employees', []))
    setCustomers(load('ledger', []))
    setSales(load('sales', []))
    setPurchases(load('purchases', []))
    setSettings(load('settings', {}))
  }

  // Restore the session from the cached token+user so a page refresh
  // keeps the user logged in until they log out (or the token expires).
  const [user, setUser] = useState(() => (getToken() ? getUser() : null))
  const [page, setPage] = useState('sale')
  const [navOpen, setNavOpen] = useState(false)

  const [products, setProducts] = useState(() => load('products', []))
  const [employees, setEmployees] = useState(() => load('employees', []))
  const [customers, setCustomers] = useState(() => load('ledger', []))
  const [sales, setSales] = useState(() => load('sales', []))
  const [purchases, setPurchases] = useState(() => load('purchases', []))
  const [settings, setSettings] = useState(() => load('settings', {}))

  const [lastSale, setLastSale] = useState(null)

  async function handleLogin(emp) {
    await syncFromServer()
    initData()
    refreshFromCache()
    persistUser(emp) // cache the user so the session survives a refresh
    setUser(emp)
    setPage('sale')
  }

  function handleLogout() {
    clearToken()
    clearUser()
    setUser(null)
  }

  function handleSaleComplete(sale) {
    setSales(load('sales', []))
    triggerPrint(sale)
  }

  function triggerPrint(sale) {
    setLastSale(sale)
    setTimeout(() => window.print(), 200)
  }

  function safePage(p) {
    if ((p === 'employees' || p === 'settings' || p === 'reports') && user.role !== 'admin') {
      message.warning('Admins only!')
      return
    }
    setPage(p)
    setNavOpen(false)
  }

  // ---- Loading ----
  if (!ready) {
    return (
      <div style={centerScreen}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🌿</div>
          <Typography.Title level={4} style={{ margin: 0 }}>AgroPoint POS</Typography.Title>
          <div style={{ margin: '16px 0' }}><Spin /></div>
          <Typography.Text type="secondary">Server se connect ho raha hai…</Typography.Text>
        </div>
      </div>
    )
  }

  // ---- Backend down ----
  if (!backendOk) {
    return (
      <div style={centerScreen}>
        <Result
          status="error"
          title="Server Band Hai"
          subTitle={
            <span>
              Node backend chal nahi raha. Terminal mein yeh command chalayein:
              <code style={codePill}>npm run dev</code>
            </span>
          }
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
              Dobara Try Karein
            </Button>
          }
        />
      </div>
    )
  }

  // ---- Login ----
  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  const saleCustomer =
    lastSale && lastSale.customerId ? customers.find((c) => c.id === lastSale.customerId) : null

  const nav = (
    <SideNav page={page} setPage={safePage} user={user} onLogout={handleLogout} settings={settings} />
  )

  return (
    <Layout style={{ height: '100vh' }}>
      {!isMobile && (
        <Sider width={SIDER_WIDTH} style={{ overflow: 'hidden' }}>
          {nav}
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          open={navOpen}
          onClose={() => setNavOpen(false)}
          width={SIDER_WIDTH}
          closable={false}
          styles={{ body: { padding: 0 }, content: { background: brand.siderBottom } }}
        >
          {nav}
        </Drawer>
      )}

      <Layout>
        <Header
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: `1px solid ${brand.border}`,
            position: 'sticky', top: 0, zIndex: 10,
          }}
        >
          {isMobile && (
            <Button type="text" icon={<MenuOutlined />} onClick={() => setNavOpen(true)} aria-label="Menu" />
          )}
          <Typography.Title level={4} style={{ margin: 0, flex: 1 }} ellipsis>
            {PAGE_TITLES[page]}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Typography.Text>
        </Header>

        <Content style={{ overflow: 'auto', padding: isMobile ? 14 : 24 }}>
          {page === 'sale' && (
            <SaleScreen
              user={user}
              products={products}
              setProducts={setProducts}
              customers={customers}
              setCustomers={setCustomers}
              onSaleComplete={handleSaleComplete}
            />
          )}
          {page === 'products' && (
            <ProductsScreen products={products} setProducts={setProducts} purchases={purchases} setPurchases={setPurchases} role={user.role} settings={settings} />
          )}
          {page === 'employees' && user.role === 'admin' && (
            <EmployeesScreen employees={employees} setEmployees={setEmployees} />
          )}
          {page === 'ledger' && (
            <LedgerScreen user={user} customers={customers} setCustomers={setCustomers} settings={settings} sales={sales} />
          )}
          {page === 'history' && (
            <HistoryScreen
              sales={sales}
              setSales={setSales}
              products={products}
              setProducts={setProducts}
              customers={customers}
              setCustomers={setCustomers}
              onReprint={triggerPrint}
            />
          )}
          {page === 'reports' && user.role === 'admin' && (
            <ReportsScreen products={products} setProducts={setProducts} sales={sales} purchases={purchases} setPurchases={setPurchases} settings={settings} />
          )}
          {page === 'settings' && user.role === 'admin' && (
            <SettingsScreen settings={settings} setSettings={setSettings} />
          )}
        </Content>
      </Layout>

      <PrintBill sale={lastSale} settings={settings} customer={saleCustomer} />
    </Layout>
  )
}

const centerScreen = {
  height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: brand.bg, padding: 24,
}
const codePill = {
  display: 'inline-block', background: '#f4f4f5', borderRadius: 6,
  padding: '2px 10px', margin: '8px 0 0', fontFamily: 'monospace',
}
