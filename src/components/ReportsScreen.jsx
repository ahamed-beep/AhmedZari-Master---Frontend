import React, { useMemo, useState } from 'react'
import {
  Card, Tabs, Statistic, Row, Col, Table, Button, Input, InputNumber, Select,
  DatePicker, Modal, Space, Segmented, Typography, Empty, App,
} from 'antd'
import { PlusOutlined, DownloadOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import dayjs from 'dayjs'
import { save, uid, money, load } from '../db.js'
import { api } from '../api.js'
import { dayKey, dayLabel, todayKey, daysAgoKey, startOfMonthKey, inRange, rangeLabel } from '../utils/date.js'
import { saleCost } from '../utils/profit.js'
import { buildLedgerPdf } from '../utils/ledgerPdf.js'

const { Text, Title } = Typography

// Chart palette (validated categorical pair — see dataviz skill).
const C_REVENUE = '#3B7DD8'
const C_PROFIT = '#1F9254'
const C_COST = '#E08600'

const fmtAxis = (v) => {
  if (Math.abs(v) >= 1000) return '₨' + (v / 1000).toFixed(Math.abs(v) % 1000 ? 1 : 0) + 'k'
  return '₨' + v
}
const shortDay = (key) => new Date(key + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function ReportsScreen({ products, setProducts, sales, purchases, setPurchases, settings }) {
  const productsById = useMemo(() => {
    const m = new Map()
    products.forEach((p) => m.set(p.id, p))
    return m
  }, [products])

  return (
    <Tabs
      defaultActiveKey="profit"
      size="large"
      items={[
        { key: 'profit', label: '💰 Profit', children: <ProfitTab sales={sales} productsById={productsById} /> },
        {
          key: 'purchases', label: '📥 Purchases',
          children: <PurchasesTab products={products} setProducts={setProducts} purchases={purchases} setPurchases={setPurchases} settings={settings} />,
        },
      ]}
    />
  )
}

/* ---------------------------- Profit tab ---------------------------- */
function ProfitTab({ sales, productsById }) {
  const [preset, setPreset] = useState('today')
  const [from, setFrom] = useState(todayKey())
  const [to, setTo] = useState(todayKey())

  function applyPreset(key) {
    setPreset(key)
    if (key === 'today') { setFrom(todayKey()); setTo(todayKey()) }
    else if (key === 'week') { setFrom(daysAgoKey(6)); setTo(todayKey()) }
    else if (key === 'month') { setFrom(startOfMonthKey()); setTo(todayKey()) }
    else if (key === 'all') { setFrom(''); setTo('') }
  }

  const filteredSales = useMemo(() => sales.filter((s) => inRange(s.date, from, to)), [sales, from, to])
  const revenue = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0)
  const cost = filteredSales.reduce((sum, s) => sum + saleCost(s, productsById), 0)
  const profit = revenue - cost

  const dayRows = useMemo(() => {
    const map = new Map()
    filteredSales.forEach((s) => {
      const key = dayKey(s.date)
      if (!map.has(key)) map.set(key, { revenue: 0, cost: 0, bills: 0 })
      const row = map.get(key)
      row.revenue += s.total || 0
      row.cost += saleCost(s, productsById)
      row.bills += 1
    })
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [filteredSales, productsById])

  // Chart wants oldest → newest, left → right.
  const chartData = useMemo(
    () => dayRows.slice().reverse().map(([key, r]) => ({
      label: shortDay(key), revenue: Math.round(r.revenue), profit: Math.round(r.revenue - r.cost),
    })),
    [dayRows]
  )

  const tableData = dayRows.map(([key, r]) => ({ key, label: dayLabel(key), ...r, profit: r.revenue - r.cost }))

  const columns = [
    { title: 'Date', dataIndex: 'label', key: 'label' },
    { title: 'Bills', dataIndex: 'bills', key: 'bills', align: 'right' },
    { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', align: 'right', render: (v) => money(v) },
    { title: 'Cost', dataIndex: 'cost', key: 'cost', align: 'right', render: (v) => money(v) },
    { title: 'Profit', dataIndex: 'profit', key: 'profit', align: 'right', render: (v) => <b className={v >= 0 ? 'text-green' : 'text-red'}>{money(v)}</b> },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card variant="outlined">
        <Space wrap style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
          <Segmented
            value={preset || 'custom'}
            onChange={applyPreset}
            options={[
              { value: 'today', label: 'Today' }, { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' }, { value: 'all', label: 'All Time' },
            ]}
          />
          <Space wrap>
            <DatePicker value={from ? dayjs(from) : null} onChange={(_, ds) => { setFrom(ds); setPreset('') }} placeholder="From" />
            <DatePicker value={to ? dayjs(to) : null} onChange={(_, ds) => { setTo(ds); setPreset('') }} placeholder="To" />
          </Space>
        </Space>

        <Text type="secondary">Showing: <b>{rangeLabel(from, to)}</b> • {filteredSales.length} bill{filteredSales.length !== 1 ? 's' : ''}</Text>

        <Row gutter={16} style={{ marginTop: 14 }}>
          <Col xs={24} sm={8}>
            <Card size="small"><Statistic title="Total Revenue" value={revenue} prefix="₨" precision={0} valueStyle={{ color: C_REVENUE }} /></Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small"><Statistic title="Total Cost" value={cost} prefix="₨" precision={0} valueStyle={{ color: C_COST }} /></Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic
                title="Total Profit" value={profit} prefix="₨" precision={0}
                valueStyle={{ color: profit >= 0 ? C_PROFIT : '#dc2626' }}
                suffix={profit >= 0 ? <RiseOutlined /> : <FallOutlined />}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card variant="outlined" title="Revenue & Profit Trend">
        {chartData.length === 0 ? (
          <Empty description="No sales in this range" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2EF" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B7A72' }} tickLine={false} axisLine={{ stroke: '#E3E9E5' }} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 12, fill: '#6B7A72' }} tickLine={false} axisLine={false} width={54} />
              <Tooltip formatter={(v, n) => [money(v), n]} contentStyle={{ borderRadius: 10, border: '1px solid #E3E9E5' }} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke={C_REVENUE} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke={C_PROFIT} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card variant="outlined" title="Day-wise Breakdown">
        <Table rowKey="key" columns={columns} dataSource={tableData} size="middle" pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: <Empty description="No sales found in this range" /> }} />
      </Card>
    </Space>
  )
}

/* -------------------------- Purchases tab -------------------------- */
const emptyPurchase = { productId: '', qty: 50, cost: 0, note: '', date: todayKey() }

function PurchasesTab({ products, setProducts, purchases, setPurchases, settings }) {
  const { message } = App.useApp()
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  function openNew() {
    setForm({ ...emptyPurchase, productId: products[0]?.id || '', cost: products[0]?.purchase || 0 })
  }
  function onProductChange(id) {
    const p = products.find((x) => x.id === id)
    setForm((f) => ({ ...f, productId: id, cost: p ? p.purchase : f.cost }))
  }

  async function savePurchase() {
    const product = products.find((p) => p.id === form.productId)
    if (!product) { message.warning('Please choose a product'); return }
    const qty = Number(form.qty) || 0
    const cost = Number(form.cost) || 0
    if (qty <= 0) { message.warning('Please enter a valid quantity'); return }
    const isoDate = form.date ? new Date(form.date + 'T' + new Date().toTimeString().slice(0, 8)).toISOString() : new Date().toISOString()
    const entry = {
      id: uid(), date: isoDate, productId: product.id, productName: product.name,
      qty, cost, total: qty * cost, note: (form.note || '').trim(), setProductCost: true,
    }
    setSaving(true)
    try {
      const { purchase, product: updatedProduct } = await api.createPurchase(entry)
      const updatedPurchases = [purchase, ...load('purchases', [])]
      setPurchases(updatedPurchases)
      save('purchases', updatedPurchases)
      const updatedProducts = products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
      setProducts(updatedProducts)
      save('products', updatedProducts)
      setForm(null)
      message.success('Purchase saved')
    } catch (err) {
      message.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return purchases.filter((p) => {
      if (!inRange(p.date, from, to)) return false
      if (q && !p.productName.toLowerCase().includes(q)) return false
      return true
    })
  }, [purchases, search, from, to])

  const totalPurchases = filtered.reduce((sum, p) => sum + p.total, 0)

  const itemSummary = useMemo(() => {
    const map = new Map()
    filtered.forEach((p) => {
      if (!map.has(p.productId)) map.set(p.productId, { name: p.productName, qty: 0, total: 0, entries: 0 })
      const row = map.get(p.productId)
      row.qty += p.qty; row.total += p.total; row.entries += 1
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filtered])

  const chartData = itemSummary.slice(0, 8).map((r) => ({ name: r.name.length > 18 ? r.name.slice(0, 17) + '…' : r.name, total: Math.round(r.total) }))

  function downloadPdf() {
    if (filtered.length === 0) { message.warning('No purchase entries in this range to export'); return }
    const rows = filtered.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((p) => ({
      date: new Date(p.date).toLocaleDateString(), product: p.productName, qty: p.qty,
      cost: money(p.cost), total: money(p.total), note: p.note || '-',
    }))
    buildLedgerPdf({
      settings, title: 'Purchase Ledger', subtitle: 'Period: ' + rangeLabel(from, to),
      columns: [
        { header: 'Date', dataKey: 'date' }, { header: 'Item Purchased', dataKey: 'product' },
        { header: 'Qty', dataKey: 'qty', halign: 'right' }, { header: 'Unit Cost', dataKey: 'cost', halign: 'right' },
        { header: 'Total', dataKey: 'total', halign: 'right' }, { header: 'Note', dataKey: 'note' },
      ],
      rows, totals: [{ label: 'Grand Total Purchases', value: totalPurchases }],
      fileName: `purchase-ledger-${from || 'all'}_${to || 'time'}.pdf`,
    })
  }

  const itemColumns = [
    { title: 'Item', dataIndex: 'name', key: 'name' },
    { title: 'Total Qty', dataIndex: 'qty', key: 'qty', align: 'right' },
    { title: 'Avg Unit Cost', key: 'avg', align: 'right', render: (_, r) => money(r.total / r.qty) },
    { title: 'Total Cost', dataIndex: 'total', key: 'total', align: 'right', render: (v) => <b>{money(v)}</b> },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card variant="outlined">
        <Space wrap style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
          <Space wrap>
            <Input allowClear placeholder="🔍 Search item" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 180 }} />
            <DatePicker value={from ? dayjs(from) : null} onChange={(_, ds) => setFrom(ds)} placeholder="From" />
            <DatePicker value={to ? dayjs(to) : null} onChange={(_, ds) => setTo(ds)} placeholder="To" />
            {(search || from || to) && <Button onClick={() => { setSearch(''); setFrom(''); setTo('') }}>Clear</Button>}
          </Space>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={downloadPdf}>Ledger PDF</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Add Purchase</Button>
          </Space>
        </Space>
        <Row gutter={16}>
          <Col xs={12}>
            <Card size="small" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
              <Statistic title={`Total Purchases — ${rangeLabel(from, to)}`} value={totalPurchases} prefix="₨" precision={0} valueStyle={{ color: C_COST }} />
            </Card>
          </Col>
          <Col xs={12}><Card size="small"><Statistic title="Entries" value={filtered.length} /></Card></Col>
        </Row>
      </Card>

      <Card variant="outlined" title="Top Items by Purchase Cost">
        {chartData.length === 0 ? (
          <Empty description="No purchase entries found" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 42)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF2EF" />
              <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 12, fill: '#6B7A72' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#41524A' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => [money(v), 'Total Cost']} contentStyle={{ borderRadius: 10, border: '1px solid #E3E9E5' }} cursor={{ fill: '#F3F7F4' }} />
              <Bar dataKey="total" fill={C_PROFIT} radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card variant="outlined" title={`Item-wise Summary — ${rangeLabel(from, to)}`}>
        <Table
          rowKey="name" columns={itemColumns} dataSource={itemSummary} size="middle"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="No purchase entries found" /> }}
          summary={() => itemSummary.length > 0 && (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><b>Grand Total</b></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><b>{itemSummary.reduce((s, r) => s + r.qty, 0)}</b></Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
              <Table.Summary.Cell index={3} align="right"><b>{money(totalPurchases)}</b></Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>

      {/* Add purchase modal */}
      <Modal open={!!form} title="Add Purchase (Stock In)" okText="Save Purchase" onOk={savePurchase} onCancel={() => setForm(null)} confirmLoading={saving} destroyOnHidden>
        {form && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size={12}>
            <Select
              value={form.productId} onChange={onProductChange} style={{ width: '100%' }}
              placeholder="Choose product"
              options={products.map((p) => ({ value: p.id, label: `${p.name} (stock: ${p.stock})` }))}
            />
            <InputNumber placeholder="Quantity purchased" value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} style={{ width: '100%' }} min={1} />
            <InputNumber placeholder="Purchase price (per unit)" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} style={{ width: '100%' }} min={0} prefix="₨" />
            <DatePicker value={form.date ? dayjs(form.date) : null} onChange={(_, ds) => setForm({ ...form, date: ds })} style={{ width: '100%' }} />
            <Input placeholder="Supplier / Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <Text type="secondary">Total: <b>{money((Number(form.qty) || 0) * (Number(form.cost) || 0))}</b> • adds {form.qty || 0} to stock.</Text>
          </Space>
        )}
      </Modal>
    </Space>
  )
}
