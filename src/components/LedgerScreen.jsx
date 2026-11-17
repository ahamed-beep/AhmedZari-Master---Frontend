import React, { useEffect, useMemo, useState } from 'react'
import {
  Card, Table, Button, Input, InputNumber, Select, Modal, Statistic, Row, Col,
  Space, Tag, Typography, Empty, DatePicker, Popconfirm, Pagination, Spin, App,
} from 'antd'
import {
  UserAddOutlined, DownloadOutlined, EyeOutlined, PlusOutlined, DeleteOutlined,
  EditOutlined, SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { save, uid, money } from '../db.js'
import { api } from '../api.js'
import { dayKey, dayLabel, rangeLabel } from '../utils/date.js'
import { buildLedgerPdf } from '../utils/ledgerPdf.js'

const { Text, Title } = Typography

// Both lists are paged by the server; these are the page sizes it is asked for.
const CUSTOMER_PAGE_SIZE = 10
const TX_PAGE_SIZE = 50

// Hold off on querying until the user stops typing.
function useDebounced(value, ms = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

// Sale bills ka note ("Sale Bill #...") aur unka reference dono dikhao.
function txNote(t) {
  return [t.note, t.ref].filter(Boolean).join(' • ')
}

export default function LedgerScreen({ user, customers, setCustomers, settings, sales = [] }) {
  const { message } = App.useApp()

  // ---- Customer directory (server-side search + paging) ----
  const [custSearch, setCustSearch] = useState('')
  const [custPage, setCustPage] = useState(1)
  const [custRows, setCustRows] = useState([])
  const [custTotal, setCustTotal] = useState(0)
  const [custLoading, setCustLoading] = useState(false)
  // Shop-wide receivable/payable, from the server — spans every customer, so
  // these tiles stay correct on page 3 and while a search is active.
  const [totals, setTotals] = useState({ toReceive: 0, toGive: 0 })

  // ---- Ledger entries (server-side search + paging) ----
  const [txRows, setTxRows] = useState([])
  const [txTotal, setTxTotal] = useState(0)
  const [txPage, setTxPage] = useState(1)
  const [txLoading, setTxLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')

  // Bumped after any mutation to re-pull both lists from the server.
  const [reload, setReload] = useState(0)

  const [custModal, setCustModal] = useState(null) // null=closed, {}=new, {id,…}=edit
  const [custForm, setCustForm] = useState({ name: '', phone: '', balance: 0 })
  const [savingCust, setSavingCust] = useState(false)
  const [txModalFor, setTxModalFor] = useState(null)
  const [txForm, setTxForm] = useState({ type: 'udhaar', amount: 0, note: '' })
  const [savingTx, setSavingTx] = useState(false)
  const [viewingSale, setViewingSale] = useState(null)

  const custQuery = useDebounced(custSearch)
  const txQuery = useDebounced(historySearch)

  useEffect(() => {
    let alive = true
    setCustLoading(true)
    api.listCustomers({ q: custQuery, page: custPage, pageSize: CUSTOMER_PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setCustRows(res.items || [])
        setCustTotal(res.total || 0)
        setTotals({ toReceive: res.toReceive || 0, toGive: res.toGive || 0 })
      })
      .catch((err) => { if (alive) message.error('Could not load customers: ' + err.message) })
      .finally(() => { if (alive) setCustLoading(false) })
    return () => { alive = false }
  }, [custQuery, custPage, reload, message])

  useEffect(() => {
    let alive = true
    setTxLoading(true)
    api.listLedgerTx({ q: txQuery, from: historyFrom, to: historyTo, page: txPage, pageSize: TX_PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setTxRows(res.items || [])
        setTxTotal(res.total || 0)
      })
      .catch((err) => { if (alive) message.error('Could not load ledger entries: ' + err.message) })
      .finally(() => { if (alive) setTxLoading(false) })
    return () => { alive = false }
  }, [txQuery, historyFrom, historyTo, txPage, reload, message])

  // Deleting the last row of the last page would otherwise leave the user
  // staring at an empty table — step back to the final populated page.
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(custTotal / CUSTOMER_PAGE_SIZE))
    if (custPage > maxPage) setCustPage(maxPage)
  }, [custTotal, custPage])
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(txTotal / TX_PAGE_SIZE))
    if (txPage > maxPage) setTxPage(maxPage)
  }, [txTotal, txPage])

  // The Sale screen's customer picker reads the full list from App state, so
  // mirror every change here into it (this screen shows only one page).
  function syncGlobalCustomers(next) {
    setCustomers(next)
    save('ledger', next)
  }

  function openNewCustomer() {
    setCustForm({ name: '', phone: '', balance: 0 })
    setCustModal({})
  }
  function openEditCustomer(cu) {
    setCustForm({ name: cu.name, phone: cu.phone || '', balance: cu.balance || 0 })
    setCustModal(cu)
  }

  async function saveCustomer() {
    const name = (custForm.name || '').trim()
    if (!name) { message.warning('Please enter a name'); return }
    const phone = (custForm.phone || '').trim()
    const isEdit = !!(custModal && custModal.id)

    setSavingCust(true)
    try {
      if (isEdit) {
        // Name/phone only. The balance is owned by the ledger entries.
        const updated = await api.updateCustomer(custModal.id, { name, phone })
        syncGlobalCustomers(customers.map((c) => (c.id === updated.id ? updated : c)))
        message.success('Customer updated')
      } else {
        const created = await api.createCustomer({
          id: uid(), name, phone, balance: Number(custForm.balance) || 0,
        })
        syncGlobalCustomers([...customers, created])
        message.success('Customer added')
      }
      setCustModal(null)
      setReload((n) => n + 1)
    } catch (err) {
      message.error('Save failed: ' + err.message)
    } finally {
      setSavingCust(false)
    }
  }

  async function deleteCustomer(id) {
    try {
      await api.deleteCustomer(id)
      syncGlobalCustomers(customers.filter((c) => c.id !== id))
      message.success('Customer deleted')
      setReload((n) => n + 1)
    } catch (err) {
      message.error('Delete failed: ' + err.message)
    }
  }

  async function saveTx() {
    const amount = Number(txForm.amount) || 0
    if (amount <= 0) { message.warning('Please enter a valid amount'); return }
    setSavingTx(true)
    try {
      const { customer } = await api.addLedgerTx({
        id: uid(), customerId: txModalFor, type: txForm.type, amount, note: txForm.note,
      })
      syncGlobalCustomers(customers.map((cu) => (cu.id === customer.id ? customer : cu)))
      setTxModalFor(null)
      setTxForm({ type: 'udhaar', amount: 0, note: '' })
      message.success('Ledger entry added')
      setReload((n) => n + 1)
    } catch (err) {
      message.error('Save failed: ' + err.message)
    } finally {
      setSavingTx(false)
    }
  }

  const salesById = useMemo(() => {
    const m = new Map()
    sales.forEach((s) => m.set(s.id, s))
    return m
  }, [sales])

  function findSalesForTx(t) {
    if (Array.isArray(t.saleIds) && t.saleIds.length) {
      return t.saleIds.map((id) => salesById.get(id)).filter(Boolean)
    }
    if (t.saleId && salesById.has(t.saleId)) return [salesById.get(t.saleId)]
    if (!t.note) return []
    const matches = [...t.note.matchAll(/#(\w{5})/g)].map((m) => m[1])
    if (!matches.length) return []
    return matches
      .map((suffix) =>
        sales.find((s) => s.id.endsWith(suffix) && s.customerId === t.customerId) ||
        sales.find((s) => s.id.endsWith(suffix)))
      .filter(Boolean)
  }

  // Entries arrive with the customer's name/phone joined in by the server.
  function customerForTx(t) {
    return t.customerName ? { name: t.customerName, phone: t.customerPhone } : null
  }

  function downloadSaleInvoicePdf(salesList, customer) {
    const list = Array.isArray(salesList) ? salesList : [salesList]
    const rows = []
    list.forEach((sale) => {
      if (list.length > 1) {
        rows.push({ item: `— Bill #${sale.id.slice(-5)} (${new Date(sale.date).toLocaleTimeString()}) —`, qty: '', price: '', total: '' })
      }
      ;(sale.items || []).forEach((it) => {
        rows.push({ item: it.name, qty: it.qty, price: money(it.price), total: money(it.price * it.qty) })
      })
    })
    const grandTotal = list.reduce((s, sale) => s + (sale.total || 0), 0)
    const subtotal = list.reduce((s, sale) => s + (sale.subtotal || 0), 0)
    const discount = list.reduce((s, sale) => s + (sale.discount || 0), 0)
    buildLedgerPdf({
      settings,
      title: list.length > 1 ? `Combined Invoice — ${list.length} Bills` : 'Sale Invoice — Bill #' + list[0].id.slice(-5),
      subtitle: 'Date: ' + new Date(list[0].date).toLocaleDateString() +
        (customer ? ` • Customer: ${customer.name}${customer.phone ? ' (' + customer.phone + ')' : ''}` : ''),
      columns: [
        { header: 'Item', dataKey: 'item' },
        { header: 'Qty', dataKey: 'qty', halign: 'right' },
        { header: 'Price', dataKey: 'price', halign: 'right' },
        { header: 'Total', dataKey: 'total', halign: 'right' },
      ],
      rows,
      totals: [
        { label: 'Subtotal', value: subtotal },
        ...(discount ? [{ label: 'Discount', value: discount, color: 'green' }] : []),
        { label: 'Grand Total', value: grandTotal },
      ],
      fileName: list.length > 1 ? `sale-invoices-${list.map((s) => s.id.slice(-5)).join('-')}.pdf` : `sale-invoice-${list[0].id.slice(-5)}.pdf`,
    })
  }

  // Entries are paged, so the statement re-fetches the WHOLE filtered set
  // rather than exporting only the page on screen.
  async function downloadStatementPdf() {
    try {
      const res = await api.listLedgerTx({ q: txQuery, from: historyFrom, to: historyTo, all: true })
      const all = res.items || []
      if (all.length === 0) { message.warning('No ledger entries in this search to export'); return }

      // Totals: agar search laga hai to sirf unhi customers ke balance jinki
      // entries PDF mein hain, warna poori shop ke totals.
      let pdfTotals = totals
      if (historySearch) {
        const ids = new Set(all.map((t) => t.customerId))
        const matched = customers.filter((c) => ids.has(c.id))
        pdfTotals = {
          toReceive: matched.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0),
          toGive: matched.reduce((s, c) => s + (c.balance < 0 ? -c.balance : 0), 0),
        }
      }

      const rows = all.map((t) => ({
        date: new Date(t.date).toLocaleDateString(),
        customer: t.customerName || '(deleted customer)',
        type: t.type === 'udhaar' ? 'To Receive (Udhaar)' : 'Received / Paid',
        amount: money(t.amount),
        note: txNote(t) || '-',
        _type: t.type,
      }))
      buildLedgerPdf({
        settings,
        title: 'Customer Ledger Statement',
        subtitle: 'Period: ' + rangeLabel(historyFrom, historyTo)
          + (historySearch ? ` • Filter: "${historySearch}"` : '')
          + ` • ${all.length} entr${all.length === 1 ? 'y' : 'ies'}`,
        columns: [
          { header: 'Date', dataKey: 'date' },
          { header: 'Customer', dataKey: 'customer' },
          { header: 'Type', dataKey: 'type' },
          { header: 'Amount', dataKey: 'amount', halign: 'right' },
          { header: 'Note', dataKey: 'note' },
        ],
        rows,
        rowStyleFn: (row) => ({ textColor: row._type === 'udhaar' ? [200, 30, 30] : [20, 130, 60] }),
        totals: [
          { label: 'Total To Receive', value: pdfTotals.toReceive, color: 'red' },
          { label: 'Total To Give / Advance', value: pdfTotals.toGive, color: 'green' },
        ],
        fileName: `customer-ledger-${historyFrom || 'all'}_${historyTo || 'time'}.pdf`,
      })
    } catch (err) {
      message.error('Export failed: ' + err.message)
    }
  }

    // Sab clients ka poora ledger — har client ka alag section, filters ignore.
  async function downloadAllClientsPdf() {
    try {
      const res = await api.listLedgerTx({ all: true })
      const all = res.items || []
      if (all.length === 0) { message.warning('Koi ledger entry nahi mili'); return }

      // Client ke hisaab se group karo.
      const groups = new Map()
      all.forEach((t) => {
        if (!groups.has(t.customerId)) {
          groups.set(t.customerId, {
            name: t.customerName || '(deleted customer)',
            phone: t.customerPhone || '',
            entries: [],
          })
        }
        groups.get(t.customerId).entries.push(t)
      })
      const list = Array.from(groups.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name))

      const rows = []
      list.forEach(([id, g]) => {
        // Section header
        rows.push({
          date: '', type: '', amount: '', note: '', _type: 'header',
          customer: `— ${g.name}${g.phone ? ' (' + g.phone + ')' : ''} —`,
        })

        // Entries, purani se nayi
        const entries = [...g.entries].sort((a, b) => (a.date < b.date ? -1 : 1))
        entries.forEach((t) => {
          rows.push({
            date: new Date(t.date).toLocaleDateString(),
            customer: g.name,
            type: t.type === 'udhaar' ? 'To Receive (Udhaar)' : 'Received / Paid',
            amount: money(t.amount),
            note: txNote(t) || '-',
            _type: t.type,
          })
        })

        // Client ka balance
        const udhaar = entries.filter((t) => t.type === 'udhaar').reduce((s, t) => s + t.amount, 0)
        const received = entries.filter((t) => t.type === 'wasooli').reduce((s, t) => s + t.amount, 0)
        const cu = customers.find((c) => c.id === id)
        const balance = cu ? cu.balance : udhaar - received
        rows.push({
          date: '',
          customer: 'Balance',
          type: balance > 0 ? 'To Receive' : balance < 0 ? 'Advance' : 'Settled',
          amount: money(Math.abs(balance)),
          note: `Udhaar ${money(udhaar)} • Received ${money(received)}`,
          _type: 'summary',
          _balance: balance,
        })
      })

      buildLedgerPdf({
        settings,
        title: 'All Clients Ledger',
        subtitle: `${list.length} client${list.length === 1 ? '' : 's'} • ${all.length} entr${all.length === 1 ? 'y' : 'ies'}`,
        columns: [
          { header: 'Date', dataKey: 'date' },
          { header: 'Customer', dataKey: 'customer' },
          { header: 'Type', dataKey: 'type' },
          { header: 'Amount', dataKey: 'amount', halign: 'right' },
          { header: 'Note', dataKey: 'note' },
        ],
        rows,
        rowStyleFn: (row) => {
          if (row._type === 'header') return { textColor: [0, 0, 0], fontStyle: 'bold' }
          if (row._type === 'summary') {
            return {
              fontStyle: 'bold',
              textColor: row._balance > 0 ? [200, 30, 30] : row._balance < 0 ? [20, 130, 60] : [0, 0, 0],
            }
          }
          return { textColor: row._type === 'udhaar' ? [200, 30, 30] : [20, 130, 60] }
        },
        totals: [
          { label: 'Total To Receive', value: totals.toReceive, color: 'red' },
          { label: 'Total To Give / Advance', value: totals.toGive, color: 'green' },
        ],
        fileName: 'all-clients-ledger.pdf',
      })
    } catch (err) {
      message.error('Export failed: ' + err.message)
    }
  }

  // Day grouping applies within the current page of entries.
  const txGroups = useMemo(() => {
    const map = new Map()
    txRows.forEach((t) => {
      const key = dayKey(t.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(t)
    })
    return Array.from(map.entries())
  }, [txRows])

  const customerColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v) => <b>{v}</b> },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', responsive: ['sm'], render: (v) => v || '—' },
    {
      title: 'Balance Due', dataIndex: 'balance', key: 'balance', align: 'right',
      render: (bal) => (
        <Text strong className={bal > 0 ? 'text-red' : bal < 0 ? 'text-green' : ''}>
          {money(Math.abs(bal))}{bal < 0 ? ' (advance)' : ''}
        </Text>
      ),
    },
    {
      title: 'Actions', key: 'actions', align: 'right', width: 280,
      render: (_, cu) => (
        <Space size={4} wrap>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setTxModalFor(cu.id)}>Entry</Button>
          <Button
            size="small" icon={<EyeOutlined />}
            onClick={() => { setHistorySearch(cu.name); setTxPage(1) }}
          >History</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditCustomer(cu)} />
          {user.role === 'admin' && (
            <Popconfirm
              title="Delete customer?"
              description="Their entire history will be deleted too."
              okText="Delete" okButtonProps={{ danger: true }}
              onConfirm={() => deleteCustomer(cu.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const historyColumns = [
    { title: 'Time', dataIndex: 'date', key: 'time', width: 100, render: (d) => new Date(d).toLocaleTimeString() },
    {
      title: 'Customer', key: 'customer',
      render: (_, t) => (
        <div>
          {t.customerName || '(deleted customer)'}
          {t.customerPhone ? <div><Text type="secondary" style={{ fontSize: 12 }}>{t.customerPhone}</Text></div> : null}
        </div>
      ),
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (type) => (
        <Tag color={type === 'udhaar' ? 'red' : 'green'}>
          {type === 'udhaar' ? 'To Receive' : 'Received / Paid'}
        </Tag>
      ),
    },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (v) => money(v) },
    { title: 'Note', key: 'note', responsive: ['md'], render: (_, t) => txNote(t) || '—' },
    {
      title: '', key: 'actions', align: 'right',
      render: (_, t) => {
        const linkedSales = findSalesForTx(t)
        return linkedSales.length > 0 ? (
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => setViewingSale({ sales: linkedSales, customer: customerForTx(t) })}>
            Items{linkedSales.length > 1 ? ` (${linkedSales.length})` : ''}
          </Button>
        ) : null
      },
    },
  ]

  return (
    <Space direction="vertical" size={18} style={{ width: '100%' }}>
      {/* Summary tiles — shop-wide, above the customer list */}
      <Row gutter={16}>
        <Col xs={12}>
          <Card size="small" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
            <Statistic title="To Receive (Lena)" value={totals.toReceive} precision={0} prefix="₨" valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
        <Col xs={12}>
          <Card size="small" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
            <Statistic title="To Give / Advance (Dena)" value={totals.toGive} precision={0} prefix="₨" valueStyle={{ color: '#16a34a' }} />
          </Card>
        </Col>
      </Row>

      {/* Customers */}
      <Card
        variant="outlined"
        title="Customer Ledger (Account)"
        extra={
          <Space wrap>
            <Input
              allowClear prefix={<SearchOutlined />} placeholder="Search name or phone"
              value={custSearch}
              onChange={(e) => { setCustSearch(e.target.value); setCustPage(1) }}
              style={{ width: 240 }}
            />
            <Button type="primary" icon={<UserAddOutlined />} onClick={openNewCustomer}>New Customer</Button>
          </Space>
        }
      >
        <Table
          rowKey="id" columns={customerColumns} dataSource={custRows} size="middle"
          loading={custLoading}
          pagination={{
            current: custPage,
            pageSize: CUSTOMER_PAGE_SIZE,
            total: custTotal,
            showSizeChanger: false,
            hideOnSinglePage: true,
            onChange: setCustPage,
            showTotal: (t, [a, b]) => `${a}-${b} of ${t}`,
          }}
          locale={{ emptyText: <Empty description={custQuery ? 'No customer matches that search' : 'No customers yet'} /> }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* Ledger history */}
      <Card variant="outlined" title="Ledger History (All Entries)">
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            allowClear placeholder="🔍 Search by customer, phone or note" value={historySearch}
            onChange={(e) => { setHistorySearch(e.target.value); setTxPage(1) }} style={{ width: 260 }}
          />
          <DatePicker placeholder="From" value={historyFrom ? dayjs(historyFrom) : null} onChange={(_, ds) => { setHistoryFrom(ds); setTxPage(1) }} />
          <DatePicker placeholder="To" value={historyTo ? dayjs(historyTo) : null} onChange={(_, ds) => { setHistoryTo(ds); setTxPage(1) }} />
          {(historySearch || historyFrom || historyTo) && (
            <Button onClick={() => { setHistorySearch(''); setHistoryFrom(''); setHistoryTo(''); setTxPage(1) }}>Clear</Button>
          )}
                <Button icon={<DownloadOutlined />} onClick={downloadStatementPdf}>Ledger PDF</Button>
          <Button icon={<DownloadOutlined />} onClick={downloadAllClientsPdf}>All Clients PDF</Button>
        </Space>

        {txLoading && (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        )}

        {!txLoading && txGroups.length === 0 && <Empty description="No ledger entries found" />}

        {!txLoading && txGroups.map(([key, dayTx]) => {
          const given = dayTx.filter((t) => t.type === 'udhaar').reduce((s, t) => s + t.amount, 0)
          const received = dayTx.filter((t) => t.type === 'wasooli').reduce((s, t) => s + t.amount, 0)
          return (
            <div key={key} style={{ marginBottom: 18 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                background: '#F3F7F4', borderRadius: '8px 8px 0 0', padding: '8px 14px',
              }}>
                <Text strong>{dayLabel(key)}</Text>
                <Text type="secondary">
                  To Receive: <b className="text-red">{money(given)}</b> • Received: <b className="text-green">{money(received)}</b>
                </Text>
              </div>
              <Table
                rowKey="id" columns={historyColumns} dataSource={dayTx} size="small"
                pagination={false} showHeader={false} scroll={{ x: 'max-content' }}
              />
            </div>
          )
        })}

        {/* Paging for the entries list (day groups above cover this page only) */}
        {txTotal > TX_PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Pagination
              current={txPage}
              pageSize={TX_PAGE_SIZE}
              total={txTotal}
              showSizeChanger={false}
              onChange={setTxPage}
              showTotal={(t, [a, b]) => `${a}-${b} of ${t} entries`}
            />
          </div>
        )}
      </Card>

      {/* New / edit customer modal */}
      <Modal
        open={custModal !== null}
        title={custModal && custModal.id ? 'Edit Customer' : 'New Customer'}
        okText="Save"
        confirmLoading={savingCust}
        onOk={saveCustomer} onCancel={() => setCustModal(null)} destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size={12}>
          <Input placeholder="Customer name" value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} />
          <Input placeholder="Phone number" value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} />
          {custModal && custModal.id ? (
            <Text type="secondary" style={{ fontSize: 12.5 }}>
              Balance ({money(Math.abs(custModal.balance || 0))}{(custModal.balance || 0) < 0 ? ' advance' : ''})
              is set by sales and ledger entries — add an entry to change it.
            </Text>
          ) : (
            <InputNumber placeholder="Opening balance (if any)" value={custForm.balance} onChange={(v) => setCustForm({ ...custForm, balance: v })} style={{ width: '100%' }} prefix="₨" />
          )}
        </Space>
      </Modal>

      {/* Ledger entry modal */}
      <Modal
        open={!!txModalFor} title="Ledger Entry" okText="Save"
        confirmLoading={savingTx}
        onOk={saveTx} onCancel={() => setTxModalFor(null)} destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size={12}>
          <Select
            value={txForm.type} onChange={(v) => setTxForm({ ...txForm, type: v })} style={{ width: '100%' }}
            options={[
              { value: 'udhaar', label: 'Credit Given (Udhaar +)' },
              { value: 'wasooli', label: 'Payment Received (−)' },
            ]}
          />
          <InputNumber placeholder="Amount" value={txForm.amount} onChange={(v) => setTxForm({ ...txForm, amount: v })} style={{ width: '100%' }} prefix="₨" min={0} />
          <Input placeholder="Note / Description" value={txForm.note} onChange={(e) => setTxForm({ ...txForm, note: e.target.value })} />
        </Space>
      </Modal>

      {/* View items modal */}
      <Modal
        open={!!viewingSale}
        title={viewingSale && (viewingSale.sales.length > 1 ? `${viewingSale.sales.length} Bills — Items Sold` : `Bill #${viewingSale.sales[0].id.slice(-5)} — Items Sold`)}
        onCancel={() => setViewingSale(null)}
        footer={[
          <Button key="pdf" type="primary" icon={<DownloadOutlined />} onClick={() => downloadSaleInvoicePdf(viewingSale.sales, viewingSale.customer)}>Download Bill PDF</Button>,
          <Button key="close" onClick={() => setViewingSale(null)}>Close</Button>,
        ]}
        width={560}
        destroyOnHidden
      >
        {viewingSale && (
          <>
            <Text type="secondary">
              {viewingSale.sales.length > 1
                ? new Date(viewingSale.sales[0].date).toLocaleDateString()
                : new Date(viewingSale.sales[0].date).toLocaleString()}
              {viewingSale.customer ? ` • ${viewingSale.customer.name}` : ''}
            </Text>
            {viewingSale.sales.map((sale) => (
              <div key={sale.id} style={{ marginTop: 12 }}>
                {viewingSale.sales.length > 1 && (
                  <Text type="secondary" strong>Bill #{sale.id.slice(-5)} • {new Date(sale.date).toLocaleTimeString()}</Text>
                )}
                <Table
                  rowKey={(r, i) => sale.id + i} size="small" pagination={false} style={{ marginTop: 6 }}
                  dataSource={sale.items || []}
                  columns={[
                    { title: 'Item', dataIndex: 'name', key: 'name' },
                    { title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'right' },
                    { title: 'Price', dataIndex: 'price', key: 'price', align: 'right', render: (v) => money(v) },
                    { title: 'Total', key: 'total', align: 'right', render: (_, it) => money(it.price * it.qty) },
                  ]}
                />
              </div>
            ))}
            <Row justify="space-between" style={{ marginTop: 14 }}>
              <Title level={5} style={{ margin: 0 }}>Combined Grand Total</Title>
              <Title level={5} style={{ margin: 0, color: '#1F9254' }}>
                {money(viewingSale.sales.reduce((s, sale) => s + (sale.total || 0), 0))}
              </Title>
            </Row>
          </>
        )}
      </Modal>
    </Space>
  )
}