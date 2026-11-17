import React, { useMemo, useState } from 'react'
import {
  Card, Table, Input, DatePicker, Button, Tag, Space, Typography, Empty,
  Modal, InputNumber, App,
} from 'antd'
import {
  PrinterOutlined, SearchOutlined, RollbackOutlined, EyeOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { load, save, uid, money } from '../db.js'
import { api } from '../api.js'

const { Text } = Typography

function dayKey(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 10)
}
function dayLabel(key) {
  const d = new Date(key + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

export default function HistoryScreen({
  sales, setSales, products, setProducts, customers, setCustomers, onReprint,
}) {
  const { message } = App.useApp()
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  // Return modal state
  const [returnFor, setReturnFor] = useState(null) // the original sale being returned
  const [returnQty, setReturnQty] = useState({}) // productId -> qty to return
  const [returnNote, setReturnNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // View invoice modal
  const [viewingSale, setViewingSale] = useState(null)

  // How much of each original sale has ALREADY been returned (productId -> qty).
  const returnedBySale = useMemo(() => {
    const map = new Map()
    sales.forEach((s) => {
      if (!s.returnOf) return
      let inner = map.get(s.returnOf)
      if (!inner) { inner = new Map(); map.set(s.returnOf, inner) }
      ;(s.items || []).forEach((it) => {
        if (!it.productId) return
        inner.set(it.productId, (inner.get(it.productId) || 0) + Math.abs(it.qty))
      })
    })
    return map
  }, [sales])

  // Remaining returnable qty across a whole sale (>0 means the Return action shows).
  function remainingForSale(sale) {
    if (sale.returnOf) return 0
    const returned = returnedBySale.get(sale.id)
    return (sale.items || []).reduce((sum, it) => {
      if (!it.productId) return sum
      return sum + Math.max(0, it.qty - (returned?.get(it.productId) || 0))
    }, 0)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return sales.filter((s) => {
      if (dateFilter && dayKey(s.date) !== dateFilter) return false
      if (!q) return true
      return (
        (s.customerName || '').toLowerCase().includes(q) ||
        (s.customerPhone || '').toLowerCase().includes(q) ||
        (s.cashier || '').toLowerCase().includes(q) ||
        (s.reference || '').toLowerCase().includes(q) ||
        s.id.slice(-6).toLowerCase().includes(q)
      )
    })
  }, [sales, search, dateFilter])

  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach((s) => {
      const key = dayKey(s.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    })
    // Newest first — latest day on top, and latest bill on top within a day.
    map.forEach((daySales) => daySales.sort((a, b) => (a.date < b.date ? 1 : -1)))
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [filtered])

  // ---------- Return flow ----------
  function openReturn(sale) {
    setReturnFor(sale)
    setReturnQty({})
    setReturnNote('')
  }

  // Live refund preview — prorates the original bill's overall discount.
  const returnPreview = useMemo(() => {
    if (!returnFor) return { lineValue: 0, refund: 0, count: 0 }
    let lineValue = 0
    let count = 0
    ;(returnFor.items || []).forEach((it) => {
      const q = Number(returnQty[it.productId]) || 0
      if (q > 0) { lineValue += it.price * q; count += q }
    })
    const refund =
      returnFor.subtotal > 0
        ? Math.round(lineValue * (returnFor.total / returnFor.subtotal) * 100) / 100
        : Math.round(lineValue * 100) / 100
    return { lineValue, refund, count }
  }, [returnFor, returnQty])

  async function submitReturn() {
    const items = Object.entries(returnQty)
      .map(([productId, qty]) => ({ productId, qty: Number(qty) || 0 }))
      .filter((it) => it.qty > 0)
    if (items.length === 0) {
      message.warning('Kam se kam ek item ki return quantity daalein')
      return
    }

    setSubmitting(true)
    try {
      const payload = { id: uid(), saleId: returnFor.id, date: new Date().toISOString(), note: returnNote.trim(), items }
      const res = await api.createReturn(payload)

      // Prepend the return row to sales history.
      const salesList = [res.return, ...sales]
      setSales(salesList)
      save('sales', salesList)

      // Merge restocked products.
      if (res.products && res.products.length) {
        const byId = new Map(res.products.map((p) => [p.id, p]))
        const updatedProducts = products.map((p) => byId.get(p.id) || p)
        setProducts(updatedProducts)
        save('products', updatedProducts)
      }

      // Ledger sale return: updated customer balance.
      if (res.customer) {
        const updatedCustomers = customers.map((cu) => (cu.id === res.customer.id ? res.customer : cu))
        setCustomers(updatedCustomers)
        save('ledger', updatedCustomers)
      }

      // Persist the ledger entry to the cache so it shows on the Ledger screen.
      if (res.ledgerTx) {
        const txList = load('ledgerTx', [])
        save('ledgerTx', [res.ledgerTx, ...txList])
      }

      message.success(
        `Return complete — ${money(Math.abs(res.return.total))} refunded` +
          (res.ledgerTx ? ' (ledger updated)' : ''),
      )
      setReturnFor(null)
    } catch (err) {
      message.error('Return save nahi hui: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Explains how a refund on a DISCOUNTED bill is prorated. Shown only in the
  // Return / View modals — deliberately NOT part of the printed bill or PDF.
  function refundMath({ lineValue, refund, origSubtotal, origTotal }) {
    const proratedDiscount = Math.round((lineValue - refund) * 100) / 100
    const hasFactor = origSubtotal > 0 && origTotal >= 0 && Math.abs(origSubtotal - origTotal) > 0.001
    const discPct = hasFactor ? Math.round((1 - origTotal / origSubtotal) * 1000) / 10 : null
    const rowStyle = { justifyContent: 'space-between', width: '100%' }
    return (
      <div style={{ background: '#F3F7F4', border: '1px solid #E3E9E5', borderRadius: 10, padding: '10px 14px' }}>
        <Text strong style={{ display: 'block', marginBottom: 6 }}>How this refund is calculated</Text>
        <Space style={rowStyle}>
          <Text type="secondary">Returned items (at bill price)</Text>
          <Text>{money(lineValue)}</Text>
        </Space>
        <Space style={rowStyle}>
          <Text type="secondary">Less bill discount{discPct != null ? ` (${discPct}%)` : ''}</Text>
          <Text className="text-red">- {money(proratedDiscount)}</Text>
        </Space>
        {hasFactor && (
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4, fontFamily: 'monospace' }}>
            Refund = {money(lineValue)} × ({money(origTotal)} ÷ {money(origSubtotal)})
          </Text>
        )}
        <Space style={{ ...rowStyle, marginTop: 6 }}>
          <Text strong>Refund payable</Text>
          <Text strong className="text-red">{money(refund)}</Text>
        </Space>
      </div>
    )
  }

  const columns = [
    { title: 'Bill #', dataIndex: 'id', key: 'id', width: 90, render: (id) => <Text code>{id.slice(-6).toUpperCase()}</Text> },
    { title: 'Time', dataIndex: 'date', key: 'time', width: 100, render: (d) => new Date(d).toLocaleTimeString() },
    {
      title: 'Customer', key: 'customer',
      render: (_, s) => (
        <div>
          {s.customerName || '—'}
          {s.customerPhone ? <div><Text type="secondary" style={{ fontSize: 12 }}>{s.customerPhone}</Text></div> : null}
        </div>
      ),
    },
    { title: 'Cashier', dataIndex: 'cashier', key: 'cashier', responsive: ['md'] },
    {
      title: 'Payment', key: 'payment',
      render: (_, s) =>
        s.returnOf ? (
          <Tag color="volcano">Refund</Tag>
        ) : (
          <Space direction="vertical" size={0}>
            <Tag color={s.paymentType === 'ledger' ? 'orange' : 'green'}>
              {s.paymentType === 'ledger' ? 'Ledger' : 'Cash'}
            </Tag>
            {s.settledImmediately ? <Text type="secondary" style={{ fontSize: 11 }}>Paid in full</Text> : null}
          </Space>
        ),
    },
    { title: 'Reference', dataIndex: 'reference', key: 'reference', responsive: ['lg'], render: (v) => v || '—' },
    {
      title: 'Total', dataIndex: 'total', key: 'total', align: 'right',
      render: (v) => <b className={v < 0 ? 'text-red' : ''}>{money(v)}</b>,
    },
    {
      title: '', key: 'actions', align: 'right', width: 220,
      render: (_, s) => (
        <Space size={4}>
          {remainingForSale(s) > 0 && (
            <Button size="small" danger icon={<RollbackOutlined />} onClick={() => openReturn(s)}>Refund</Button>
          )}
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewingSale(s)}>View</Button>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => onReprint(s)}>Print</Button>
        </Space>
      ),
    },
  ]

  const returned = returnFor ? returnedBySale.get(returnFor.id) : null

  return (
    <Card
      variant="outlined"
      title="Sales History"
      extra={
        <Space wrap>
          <Input
            allowClear prefix={<SearchOutlined />} placeholder="Customer, phone, cashier, bill #…"
            value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }}
          />
          <DatePicker value={dateFilter ? dayjs(dateFilter) : null} onChange={(_, ds) => setDateFilter(ds)} />
          {(search || dateFilter) && <Button onClick={() => { setSearch(''); setDateFilter('') }}>Clear</Button>}
        </Space>
      }
    >
      {groups.length === 0 && <Empty description="No sales found" />}

      {groups.map(([key, daySales]) => {
        const dayTotal = daySales.reduce((s, x) => s + x.total, 0)
        const cashTotal = daySales.filter((s) => s.paymentType !== 'ledger').reduce((s, x) => s + x.total, 0)
        const ledgerTotal = daySales.filter((s) => s.paymentType === 'ledger').reduce((s, x) => s + x.total, 0)
        const billCount = daySales.filter((s) => !s.returnOf).length
        const returnCount = daySales.length - billCount
        return (
          <div key={key} style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
              background: '#fff', padding: '8px 14px 10px', marginBottom: 6,
            }}>
              <Text strong>{dayLabel(key)}</Text>
              <Text type="secondary">
                {billCount} bill{billCount !== 1 ? 's' : ''}
                {returnCount > 0 && <> • {returnCount} return{returnCount !== 1 ? 's' : ''}</>}
                {' • '}Cash: {money(cashTotal)}
                {ledgerTotal !== 0 && <> • Ledger: {money(ledgerTotal)}</>} • Total: <b>{money(dayTotal)}</b>
              </Text>
            </div>
            <Table
              rowKey="id" columns={columns} dataSource={daySales} size="small"
              pagination={false} scroll={{ x: 'max-content' }}
            />
          </div>
        )
      })}

      {/* Return / refund modal */}
      <Modal
        open={!!returnFor}
        title={returnFor ? `Return items — Bill #${returnFor.id.slice(-6).toUpperCase()}` : ''}
        okText={`Confirm return${returnPreview.refund ? ' • ' + money(returnPreview.refund) : ''}`}
        okButtonProps={{ danger: true, disabled: returnPreview.count === 0 }}
        confirmLoading={submitting}
        onOk={submitReturn}
        onCancel={() => setReturnFor(null)}
        width={620}
        destroyOnHidden
      >
        {returnFor && (
          <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
            <Text type="secondary">
              Sirf return honay wali quantity daalein. Stock wapas add ho jayega
              {returnFor.paymentType === 'ledger' && returnFor.customerId
                ? ` aur ${returnFor.customerName} ke ledger se raqam kam ho jayegi.`
                : '.'}
            </Text>
            <Table
              rowKey="productId"
              size="small"
              pagination={false}
              dataSource={(returnFor.items || []).filter((it) => it.productId)}
              columns={[
                { title: 'Item', dataIndex: 'name', key: 'name' },
                { title: 'Price', dataIndex: 'price', key: 'price', align: 'right', render: (v) => money(v) },
                { title: 'Sold', dataIndex: 'qty', key: 'qty', align: 'right' },
                {
                  title: 'Returnable', key: 'remaining', align: 'right',
                  render: (_, it) => it.qty - (returned?.get(it.productId) || 0),
                },
                {
                  title: 'Return qty', key: 'return', align: 'right', width: 110,
                  render: (_, it) => {
                    const max = it.qty - (returned?.get(it.productId) || 0)
                    return (
                      <InputNumber
                        size="small" min={0} max={max} disabled={max <= 0}
                        value={returnQty[it.productId] || 0}
                        onChange={(v) =>
                          setReturnQty((prev) => ({ ...prev, [it.productId]: Math.min(max, Math.max(0, Number(v) || 0)) }))
                        }
                        style={{ width: 84 }}
                      />
                    )
                  },
                },
              ]}
            />
            <Input
              placeholder="Reason / note (optional)"
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
            />
            {Number(returnFor.discount) !== 0 && returnPreview.count > 0 &&
              refundMath({
                lineValue: returnPreview.lineValue,
                refund: returnPreview.refund,
                origSubtotal: returnFor.subtotal,
                origTotal: returnFor.total,
              })}
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px' }}>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Text>Items to return: <b>{returnPreview.count}</b></Text>
                <Text>Refund amount: <b className="text-red">{money(returnPreview.refund)}</b></Text>
              </Space>
            </div>
          </Space>
        )}
      </Modal>

      {/* View invoice modal */}
      <Modal
        open={!!viewingSale}
        title={
          viewingSale
            ? `${viewingSale.returnOf ? 'Return' : 'Invoice'} — Bill #${viewingSale.id.slice(-6).toUpperCase()}`
            : ''
        }
        onCancel={() => setViewingSale(null)}
        footer={[
          <Button key="print" icon={<PrinterOutlined />} onClick={() => { onReprint(viewingSale); setViewingSale(null) }}>
            Print
          </Button>,
          <Button key="close" type="primary" onClick={() => setViewingSale(null)}>Close</Button>,
        ]}
        width={620}
        destroyOnHidden
      >
        {viewingSale && (
          <Space direction="vertical" size={14} style={{ width: '100%', marginTop: 8 }}>
            {/* Meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Space direction="vertical" size={0}>
                <Text strong>{viewingSale.customerName || 'Walk-in customer'}</Text>
                {viewingSale.customerPhone && <Text type="secondary" style={{ fontSize: 12.5 }}>{viewingSale.customerPhone}</Text>}
              </Space>
              <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12.5 }}>{new Date(viewingSale.date).toLocaleString()}</Text>
                {viewingSale.cashier && <Text type="secondary" style={{ fontSize: 12.5 }}>Cashier: {viewingSale.cashier}</Text>}
              </Space>
            </div>

            <Space size={6} wrap>
              {viewingSale.returnOf ? (
                <Tag color="volcano">Refund</Tag>
              ) : (
                <Tag color={viewingSale.paymentType === 'ledger' ? 'orange' : 'green'}>
                  {viewingSale.paymentType === 'ledger' ? 'Ledger' : 'Cash'}
                </Tag>
              )}
              {viewingSale.settledImmediately && <Tag color="green">Paid in full</Tag>}
              {viewingSale.reference && <Text type="secondary" style={{ fontSize: 12.5 }}>{viewingSale.reference}</Text>}
            </Space>

            {/* Items */}
            <Table
              rowKey={(r, i) => (r.productId || r.name) + '-' + i}
              size="small"
              pagination={false}
              dataSource={viewingSale.items || []}
              columns={[
                { title: 'Item', dataIndex: 'name', key: 'name' },
                { title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'right' },
                { title: 'Price', dataIndex: 'price', key: 'price', align: 'right', render: (v) => money(v) },
                { title: 'Total', key: 'total', align: 'right', render: (_, it) => <b>{money(it.price * it.qty)}</b> },
              ]}
            />

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 240 }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text type="secondary">Subtotal</Text>
                  <Text>{money(viewingSale.subtotal)}</Text>
                </Space>
                {Number(viewingSale.discount) !== 0 && (
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Text type="secondary">Discount</Text>
                    <Text className="text-green">- {money(Math.abs(viewingSale.discount))}</Text>
                  </Space>
                )}
                <Space style={{ justifyContent: 'space-between', width: '100%', marginTop: 4 }}>
                  <Text strong>Grand Total</Text>
                  <Text strong style={{ fontSize: 16 }} className={viewingSale.total < 0 ? 'text-red' : ''}>
                    {money(viewingSale.total)}
                  </Text>
                </Space>
              </div>
            </div>

            {/* Refund math — only for a return of a discounted invoice */}
            {viewingSale.returnOf && Number(viewingSale.discount) !== 0 && (() => {
              const orig = sales.find((x) => x.id === viewingSale.returnOf)
              return refundMath({
                lineValue: Math.abs(viewingSale.subtotal),
                refund: Math.abs(viewingSale.total),
                origSubtotal: orig ? orig.subtotal : undefined,
                origTotal: orig ? orig.total : undefined,
              })
            })()}
          </Space>
        )}
      </Modal>
    </Card>
  )
}
