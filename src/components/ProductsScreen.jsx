import React, { useCallback, useMemo, useState } from 'react'
import {
  Card, Table, Button, Input, InputNumber, Modal, Form, Tag, Space,
  Popconfirm, Typography, App, Grid, Row, Col, Statistic,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  CameraOutlined, InboxOutlined, AppstoreOutlined, WalletOutlined, TagOutlined,
  FilePdfOutlined,
} from '@ant-design/icons'
import { save, uid, money, load } from '../db.js'
import { api } from '../api.js'
import { buildLedgerPdf } from '../utils/ledgerPdf.js'
import useHardwareScanner from '../hooks/useHardwareScanner.js'
import BarcodeScanner from './BarcodeScanner.jsx'

const emptyProduct = { name: '', barcode: '', category: '', purchase: 0, price: 0, stock: 0, unit: 'bottle' }

export default function ProductsScreen({ products, setProducts, purchases, setPurchases, role, settings }) {
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()
  const isAdmin = role === 'admin'
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // null=closed, {}=new, {...}=edit
  const [form] = Form.useForm()
  const [showScanner, setShowScanner] = useState(false)
  const [stockFor, setStockFor] = useState(null)
  const [stockQty, setStockQty] = useState(50)
  const [savingStock, setSavingStock] = useState(false)

  // Plug-and-scan while the product form is open.
  const handleHardwareScan = useCallback((code) => {
    setEditing((cur) => {
      if (cur === null) return cur
      form.setFieldValue('barcode', code)
      message.success(`Barcode captured: ${code}`)
      return cur
    })
  }, [form, message])
  useHardwareScanner(handleHardwareScan, editing !== null)

  function handleCameraDetected(code) {
    form.setFieldValue('barcode', code)
    setShowScanner(false)
    message.success(`Barcode captured: ${code}`)
    return true
  }

  const filtered = products.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search)
  )

  // Inventory totals across all products (qty-weighted valuations).
  const totals = useMemo(() => products.reduce(
    (acc, p) => {
      const stock = Number(p.stock) || 0
      acc.qty += stock
      acc.purchaseValue += (Number(p.purchase) || 0) * stock
      acc.saleValue += (Number(p.price) || 0) * stock
      return acc
    },
    { qty: 0, purchaseValue: 0, saleValue: 0 },
  ), [products])

  // Stock report PDF — the rows currently listed (all products unless searching).
  function downloadStockPdf() {
    if (filtered.length === 0) { message.warning('No products to export'); return }
    const list = filtered.slice().sort((a, b) => a.name.localeCompare(b.name))
    const sums = list.reduce(
      (acc, p) => {
        const stock = Number(p.stock) || 0
        acc.qty += stock
        acc.purchaseValue += (Number(p.purchase) || 0) * stock
        acc.saleValue += (Number(p.price) || 0) * stock
        return acc
      },
      { qty: 0, purchaseValue: 0, saleValue: 0 },
    )
    const rows = list.map((p) => {
      const stock = Number(p.stock) || 0
      return {
        name: p.name,
        barcode: p.barcode || '-',
        category: p.category || '-',
        stock: `${stock} ${p.unit || ''}`.trim(),
        status: stock <= 0 ? 'Out' : stock < 10 ? 'Low' : 'In Stock',
        purchase: money(p.purchase || 0),
        price: money(p.price || 0),
        value: money((isAdmin ? Number(p.purchase) || 0 : Number(p.price) || 0) * stock),
        _stock: stock,
      }
    })
    buildLedgerPdf({
      settings,
      title: 'Stock Report',
      subtitle: `${list.length} product${list.length === 1 ? '' : 's'}`
        + (search ? ` • filtered by "${search}"` : ' • all products'),
      columns: [
        { header: 'Product', dataKey: 'name' },
        { header: 'Barcode', dataKey: 'barcode' },
        { header: 'Category', dataKey: 'category' },
        { header: 'Stock', dataKey: 'stock', halign: 'right' },
        { header: 'Status', dataKey: 'status' },
        ...(isAdmin ? [{ header: 'Purchase', dataKey: 'purchase', halign: 'right' }] : []),
        { header: 'Sale Price', dataKey: 'price', halign: 'right' },
        { header: isAdmin ? 'Stock Value' : 'Value (Sale)', dataKey: 'value', halign: 'right' },
      ],
      rows,
      // Flag the shortages so a shopkeeper can spot what to re-order at a glance.
      rowStyleFn: (r) => (r._stock <= 0 ? { textColor: [200, 30, 30] }
        : r._stock < 10 ? { textColor: [190, 110, 10] } : undefined),
      totals: [
        { label: 'Total Products', text: String(list.length) },
        { label: 'Total Stock Quantity', text: `${sums.qty} units` },
        ...(isAdmin ? [{ label: 'Stock Value (at Purchase Price)', value: sums.purchaseValue }] : []),
        { label: 'Stock Value (at Sale Price)', value: sums.saleValue },
      ],
      fileName: `stock-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }

  function openNew() {
    form.resetFields()
    form.setFieldsValue(emptyProduct)
    setEditing({})
  }
  function openEdit(p) {
    form.resetFields()
    form.setFieldsValue(p)
    setEditing(p)
  }

  function handleSave(values) {
    const data = {
      name: (values.name || '').trim(),
      barcode: (values.barcode || '').trim(),
      category: (values.category || '').trim(),
      unit: (values.unit || '').trim() || 'piece',
      purchase: Number(values.purchase) || 0,
      price: Number(values.price) || 0,
      stock: Number(values.stock) || 0,
    }
    const isEdit = !!(editing && editing.id)
    const id = isEdit ? editing.id : uid()
    const item = { id, ...data }
    const updated = isEdit
      ? products.map((p) => (p.id === id ? { ...p, ...data } : p))
      : [...products, item]
    setProducts(updated)
    save('products', updated)
    setEditing(null)
    const req = isEdit ? api.updateProduct(id, item) : api.createProduct(item)
    req.then(() => message.success('Product saved')).catch((err) => message.error('Save failed: ' + err.message))
  }

  function handleDelete(id) {
    const updated = products.filter((p) => p.id !== id)
    setProducts(updated)
    save('products', updated)
    api.deleteProduct(id).then(() => message.success('Product deleted')).catch((err) => message.error('Delete failed: ' + err.message))
  }

  async function saveStock() {
    const qty = Number(stockQty) || 0
    if (qty <= 0) { message.warning('Please enter a valid quantity'); return }
    const entry = {
      id: uid(), date: new Date().toISOString(), productId: stockFor.id, productName: stockFor.name,
      qty, cost: stockFor.purchase || 0, total: qty * (stockFor.purchase || 0), note: 'Quick stock add',
      setProductCost: false,
    }
    setSavingStock(true)
    try {
      const { purchase, product } = await api.createPurchase(entry)
      const updatedProducts = products.map((p) => (p.id === product.id ? product : p))
      setProducts(updatedProducts)
      save('products', updatedProducts)
      if (setPurchases) {
        const updatedPurchases = [purchase, ...load('purchases', [])]
        setPurchases(updatedPurchases)
        save('purchases', updatedPurchases)
      }
      message.success(`Added ${qty} to ${stockFor.name}`)
      setStockFor(null)
    } catch (err) {
      message.error('Stock add failed: ' + err.message)
    } finally {
      setSavingStock(false)
    }
  }

  function stockTag(stock) {
    if (stock <= 0) return <Tag color="red">Out</Tag>
    if (stock < 10) return <Tag color="orange">Low</Tag>
    return <Tag color="green">In Stock</Tag>
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (v) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'Barcode', dataIndex: 'barcode', key: 'barcode', responsive: ['md'], render: (v) => v || '—' },
    { title: 'Category', dataIndex: 'category', key: 'category', responsive: ['lg'], render: (v) => v || '—' },
    ...(isAdmin ? [{ title: 'Purchase', dataIndex: 'purchase', key: 'purchase', align: 'right', responsive: ['lg'], render: (v) => money(v) }] : []),
    { title: 'Sale Price', dataIndex: 'price', key: 'price', align: 'right', sorter: (a, b) => a.price - b.price, render: (v) => <Typography.Text strong style={{ color: '#1F9254' }}>{money(v)}</Typography.Text> },
    {
      title: 'Stock', dataIndex: 'stock', key: 'stock', align: 'right', sorter: (a, b) => a.stock - b.stock,
      render: (v, r) => <Space size={6}>{v} {r.unit}{stockTag(v)}</Space>,
    },
    ...(isAdmin ? [{
      title: 'Actions', key: 'actions', align: 'right', width: 180, fixed: screens.md ? undefined : 'right',
      render: (_, p) => (
        <Space size={4} wrap>
          <Button size="small" icon={<InboxOutlined />} onClick={() => { setStockFor(p); setStockQty(50) }}>Stock</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(p)} />
          <Popconfirm title="Delete this product?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(p.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  return (
    <Card
      variant="outlined"
      title="Products"
      extra={
        <Space wrap>
          <Input
            allowClear prefix={<SearchOutlined />} placeholder="Search product"
            value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }}
          />
          <Button icon={<FilePdfOutlined />} onClick={downloadStockPdf}>Export PDF</Button>
          {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Add Product</Button>}
        </Space>
      }
    >
      {/* Inventory summary tiles */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={isAdmin ? 8 : 12}>
          <Card size="small" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
            <Statistic
              title="Total Stock Quantity"
              value={totals.qty}
              prefix={<AppstoreOutlined style={{ marginInlineEnd: 6, color: '#1F9254' }} />}
              suffix="units"
              valueStyle={{ color: '#1F9254' }}
            />
          </Card>
        </Col>
        {isAdmin && (
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
              <Statistic
                title="Stock Value (at Purchase Price)"
                value={totals.purchaseValue}
                precision={0}
                prefix={<WalletOutlined style={{ marginInlineEnd: 6, color: '#D97706' }} />}
                valueStyle={{ color: '#D97706' }}
                formatter={(v) => money(v)}
              />
            </Card>
          </Col>
        )}
        <Col xs={24} sm={isAdmin ? 8 : 12}>
          <Card size="small" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
            <Statistic
              title="Stock Value (at Sale Price)"
              value={totals.saleValue}
              precision={0}
              prefix={<TagOutlined style={{ marginInlineEnd: 6, color: '#3B7DD8' }} />}
              valueStyle={{ color: '#3B7DD8' }}
              formatter={(v) => money(v)}
            />
          </Card>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        size="middle"
        pagination={{ pageSize: 12, hideOnSinglePage: true, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
      />

      {/* Add / edit product */}
      <Modal
        open={isAdmin && editing !== null}
        title={editing && editing.id ? 'Edit Product' : 'New Product'}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Save"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark="optional" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Product name" rules={[{ required: true, message: 'Enter a name' }]}>
            <Input placeholder="e.g. Confidor 200SL (100ml)" />
          </Form.Item>
          <Form.Item name="barcode" label="Barcode">
            <Input
              placeholder="Scan or type manually"
              addonAfter={<CameraOutlined onClick={() => setShowScanner(true)} style={{ cursor: 'pointer' }} />}
            />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="category" label="Category" style={{ flex: 1 }}>
              <Input placeholder="Insecticide / Weedicide…" />
            </Form.Item>
            <Form.Item name="unit" label="Unit" style={{ flex: 1 }}>
              <Input placeholder="bottle / kg / litre" />
            </Form.Item>
          </Space>
          <Form.Item name="purchase" label="Purchase price">
            <InputNumber min={0} style={{ width: '100%' }} prefix="₨" />
          </Form.Item>
          <Form.Item name="price" label="Sale price">
            <InputNumber min={0} style={{ width: '100%' }} prefix="₨" />
          </Form.Item>
          <Form.Item name="stock" label="Stock qty">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            🔌 USB Scanner Ready — point and scan; the barcode field fills automatically.
          </Typography.Text>
        </Form>
      </Modal>

      {/* Quick add stock */}
      <Modal
        open={isAdmin && !!stockFor}
        title={stockFor ? `Add Stock — ${stockFor.name}` : ''}
        onCancel={() => setStockFor(null)}
        onOk={saveStock}
        okText="Add Stock"
        confirmLoading={savingStock}
        destroyOnHidden
      >
        {stockFor && (
          <>
            <Typography.Paragraph type="secondary">
              Current stock: {stockFor.stock} {stockFor.unit}
            </Typography.Paragraph>
            <InputNumber
              autoFocus min={1} value={stockQty} onChange={(v) => setStockQty(v)}
              style={{ width: '100%' }} size="large" placeholder="Quantity to add"
            />
          </>
        )}
      </Modal>

      {showScanner && <BarcodeScanner onDetected={handleCameraDetected} onClose={() => setShowScanner(false)} />}
    </Card>
  )
}
