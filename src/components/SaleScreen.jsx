import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Row, Col, Card, Input, InputNumber, Button, Select, Segmented, Checkbox,
  Empty, Typography, Tag, Alert, Space, Divider, App, Grid,
} from 'antd'
import {
  SearchOutlined, CameraOutlined, DeleteOutlined, ShoppingCartOutlined,
} from '@ant-design/icons'
import { load, save, uid, money } from '../db.js'
import { api } from '../api.js'
import { brand } from '../theme.js'
import BarcodeScanner from './BarcodeScanner.jsx'
import useHardwareScanner from '../hooks/useHardwareScanner.js'

const { Text, Title } = Typography

export default function SaleScreen({ user, products, setProducts, customers, setCustomers, onSaleComplete }) {
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.lg

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [discType, setDiscType] = useState('amount')
  const [discValue, setDiscValue] = useState(0)
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [reference, setReference] = useState('')
  const [paymentType, setPaymentType] = useState('cash')
  const [paidImmediately, setPaidImmediately] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanFlash, setScanFlash] = useState(null) // {ok, msg}
  const [submitting, setSubmitting] = useState(false)

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q)
    )
  }, [products, search])

  function addToCart(product) {
    if (product.stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id)
      if (existing) {
        if (existing.qty + 1 > product.stock) {
          message.warning('Not enough stock!')
          return prev
        }
        return prev.map((c) => (c.productId === product.id ? { ...c, qty: c.qty + 1 } : c))
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, cost: product.purchase || 0, qty: 1 }]
    })
  }

  const productsRef = useRef(products)
  productsRef.current = products

  function handleBarcodeDetected(code) {
    const p = productsRef.current.find((x) => x.barcode === code)
    if (p) {
      addToCart(p)
      setShowScanner(false)
      setScanFlash({ ok: true, msg: `Added: ${p.name}` })
    } else {
      setScanFlash({ ok: false, msg: `No product matches barcode "${code}"` })
    }
    setTimeout(() => setScanFlash(null), 1800)
    return !!p
  }

  const handleHardwareScan = useCallback((code) => {
    handleBarcodeDetected(code)
  }, [])
  useHardwareScanner(handleHardwareScan, true)

  function updateQty(i, v) {
    setCart((prev) => prev.map((c, idx) => (idx === i ? { ...c, qty: Math.max(1, Number(v) || 1) } : c)))
  }
  function updatePrice(i, v) {
    setCart((prev) => prev.map((c, idx) => (idx === i ? { ...c, price: Math.max(0, Number(v) || 0) } : c)))
  }
  function removeItem(i) {
    setCart((prev) => prev.filter((_, idx) => idx !== i))
  }
  function clearCart() {
    setCart([])
    setDiscValue(0)
    setReference('')
    setCustomerId('')
    setCustomerName('')
    setCustomerPhone('')
    setPaymentType('cash')
    setPaidImmediately(false)
  }

  const subtotal = cart.reduce((sum, it) => sum + it.price * it.qty, 0)
  const overallDiscount = Math.min(
    discType === 'percent' ? subtotal * (discValue / 100) : discValue,
    subtotal
  )
  const grandTotal = subtotal - overallDiscount

  async function checkout() {
    if (cart.length === 0) {
      message.warning('Cart is empty!')
      return
    }
    if (!customerName.trim()) {
      message.warning('Please enter the customer name')
      return
    }
    if (paymentType === 'ledger' && !customerId) {
      message.warning('Please select a customer for a ledger (credit) sale')
      return
    }

    const settleNow = paymentType === 'ledger' && paidImmediately
    const effectivePaymentType = settleNow ? 'cash' : paymentType

    const sale = {
      id: uid(),
      date: new Date().toISOString(),
      cashier: user.name,
      items: cart.map((it) => ({ ...it })),
      subtotal,
      discount: overallDiscount,
      total: grandTotal,
      paymentType: effectivePaymentType,
      settledImmediately: settleNow,
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      reference,
    }

    setSubmitting(true)
    try {
      // Transactional checkout: server stock decrement + sale insert +
      // (ledger sale par) customer balance + udhaar merge — ek transaction.
      const res = await api.createSale(sale)

      if (res.products && res.products.length) {
        const byId = new Map(res.products.map((p) => [p.id, p]))
        const updatedProducts = products.map((p) => byId.get(p.id) || p)
        setProducts(updatedProducts)
        save('products', updatedProducts)
      }

      const salesList = [res.sale, ...load('sales', [])]
      save('sales', salesList)

      if (res.customer) {
        const updatedCustomers = customers.map((cu) => (cu.id === res.customer.id ? res.customer : cu))
        setCustomers(updatedCustomers)
        save('ledger', updatedCustomers)
      }

      if (res.ledgerTx) {
        const txList = load('ledgerTx', [])
        const idx = txList.findIndex((t) => t.id === res.ledgerTx.id)
        if (idx !== -1) txList[idx] = res.ledgerTx
        else txList.unshift(res.ledgerTx)
        save('ledgerTx', txList)
      }

      message.success('Sale complete — printing bill')
      onSaleComplete(res.sale)
      clearCart()
    } catch (err) {
      message.error('Sale server par save nahi hui: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Product grid ----------
  const productGrid = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 185}px, 1fr))`,
        gap: 14,
      }}
    >
      {filteredProducts.map((p) => {
        const out = p.stock <= 0
        const low = p.stock > 0 && p.stock < 10
        return (
          <Card
            key={p.id}
            hoverable={!out}
            onClick={() => addToCart(p)}
            styles={{ body: { padding: 14 } }}
            style={{ opacity: out ? 0.5 : 1, cursor: out ? 'not-allowed' : 'pointer' }}
          >
            <Text strong style={{ display: 'block', lineHeight: 1.3, minHeight: 38 }}>
              {p.name}
            </Text>
            <div style={{ margin: '6px 0' }}>
              <Text type="secondary" style={{ fontSize: 12.5 }}>{p.category || 'Uncategorized'}</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text strong style={{ color: brand.primary, fontSize: 16 }}>{money(p.price)}</Text>
              <Tag color={out ? 'red' : low ? 'orange' : 'green'} style={{ marginInlineEnd: 0 }}>
                {out ? 'Out' : `${p.stock} ${p.unit || ''}`.trim()}
              </Tag>
            </div>
          </Card>
        )
      })}
      {filteredProducts.length === 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Empty description="No products found" />
        </div>
      )}
    </div>
  )

  // ---------- Cart panel ----------
  const cartPanel = (
    <Card
      title={
        <Space>
          <ShoppingCartOutlined />
          <span>Cart</span>
          {cart.length > 0 && <Tag color="green">{cart.length}</Tag>}
        </Space>
      }
      styles={{ body: { padding: 0 } }}
    >
      {/* Line items */}
      <div style={{ maxHeight: isMobile ? 220 : 260, overflow: 'auto', padding: '4px 16px' }}>
        {cart.length === 0 && (
          <div style={{ padding: '24px 0' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Cart is empty" />
          </div>
        )}
        {cart.map((item, i) => {
          const original = products.find((p) => p.id === item.productId)
          const changed = original && Number(item.price) !== Number(original.price)
          return (
            <div
              key={i}
              style={{
                display: 'flex', gap: 8, alignItems: 'center',
                padding: '10px 0', borderBottom: `1px solid ${brand.border}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ display: 'block', lineHeight: 1.3 }}>{item.name}</Text>
                {changed && original && (
                  <Text type="secondary" delete style={{ fontSize: 12 }}>{money(original.price)}</Text>
                )}
              </div>
              <InputNumber
                size="small" min={1} value={item.qty}
                onChange={(v) => updateQty(i, v)}
                style={{ width: 58 }}
              />
              <InputNumber
                size="small" min={0} value={item.price}
                onChange={(v) => updatePrice(i, v)}
                style={{ width: 84 }}
                prefix="₨"
              />
              <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => removeItem(i)} />
            </div>
          )
        })}
      </div>

      <Divider style={{ margin: 0 }} />

      {/* Customer + payment */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Select
          showSearch
          optionFilterProp="label"
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          value={customerId || ''}
          onChange={(id) => {
            setCustomerId(id)
            const cu = customers.find((c) => c.id === id)
            if (cu) {
              setCustomerName(cu.name || '')
              setCustomerPhone(cu.phone || '')
            } else {
              // Walk-in customer selected — clear the manual fields.
              setCustomerName('')
              setCustomerPhone('')
            }
          }}
          options={[
            { value: '', label: 'Walk-in customer (Cash, no ledger)' },
            ...customers.map((cu) => ({ value: cu.id, label: `${cu.name} (Balance: ${money(cu.balance)})` })),
          ]}
        />

        <Space.Compact block>
          <Input
            placeholder="👤 Customer name *"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <Input
            placeholder="📞 Phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            style={{ width: '45%' }}
          />
        </Space.Compact>

        <Input placeholder="Reference / Note" value={reference} onChange={(e) => setReference(e.target.value)} />

        <Space.Compact block>
          <Select
            value={discType}
            onChange={setDiscType}
            style={{ width: 130 }}
            options={[{ value: 'amount', label: '₨ Discount' }, { value: 'percent', label: '% Discount' }]}
          />
          <InputNumber
            min={0}
            value={discValue}
            onChange={(v) => setDiscValue(Number(v) || 0)}
            placeholder="Overall discount"
            style={{ width: '100%' }}
          />
        </Space.Compact>

        <Segmented
          block
          value={paymentType}
          onChange={setPaymentType}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'ledger', label: 'Ledger (Credit)' },
          ]}
        />

        {paymentType === 'ledger' && (
          <Checkbox checked={paidImmediately} onChange={(e) => setPaidImmediately(e.target.checked)}>
            <Text style={{ fontSize: 12.5 }}>✅ Paid in full right now (counts as today's cash sale)</Text>
          </Checkbox>
        )}

        {/* Totals */}
        <div style={{ background: brand.mint, borderRadius: 10, padding: '10px 14px' }}>
          <Row justify="space-between"><Text type="secondary">Subtotal</Text><Text>{money(subtotal)}</Text></Row>
          {overallDiscount > 0 && (
            <Row justify="space-between"><Text type="secondary">Discount</Text><Text>- {money(overallDiscount)}</Text></Row>
          )}
          <Row justify="space-between" align="middle" style={{ marginTop: 4 }}>
            <Text strong>Grand Total</Text>
            <Title level={4} style={{ margin: 0, color: brand.primary }}>{money(grandTotal)}</Title>
          </Row>
        </div>

        <Space.Compact block>
          <Button type="primary" size="large" block loading={submitting} onClick={checkout} icon={<ShoppingCartOutlined />}>
            Checkout & Print
          </Button>
          <Button size="large" danger icon={<DeleteOutlined />} onClick={clearCart} />
        </Space.Compact>
      </div>
    </Card>
  )

  // ---------- Search + hint ----------
  const searchBar = (
    <Space direction="vertical" style={{ width: '100%' }} size={10}>
      <Space.Compact block size="large">
        <Input
          size="large"
          allowClear
          prefix={<SearchOutlined style={{ color: brand.muted }} />}
          placeholder="Search product by name or barcode"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button size="large" icon={<CameraOutlined />} onClick={() => setShowScanner(true)}>
          {isMobile ? '' : 'Scan'}
        </Button>
      </Space.Compact>
      <Text type="secondary" style={{ fontSize: 12.5 }}>
        🔌 USB Scanner Ready — just scan, no click needed
      </Text>
      {scanFlash && (
        <Alert
          type={scanFlash.ok ? 'success' : 'error'}
          message={scanFlash.msg}
          showIcon
          banner
        />
      )}
    </Space>
  )

  return (
    <>
      {isMobile ? (
        <Space direction="vertical" style={{ width: '100%' }} size={14}>
          {searchBar}
          {cartPanel}
          {productGrid}
        </Space>
      ) : (
        <Row gutter={20} style={{ height: '100%' }} wrap={false}>
          <Col flex="auto" style={{ minWidth: 0, height: '100%', overflow: 'auto', paddingRight: 4 }}>
            <div style={{ marginBottom: 16 }}>{searchBar}</div>
            {productGrid}
          </Col>
          <Col flex="380px">
            <div style={{ position: 'sticky', top: 0 }}>{cartPanel}</div>
          </Col>
        </Row>
      )}

      {showScanner && (
        <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setShowScanner(false)} />
      )}
    </>
  )
}
