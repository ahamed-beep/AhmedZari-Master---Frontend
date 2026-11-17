import React from 'react'
import { money } from '../db.js'

export default function PrintBill({ sale, settings, customer }) {
  if (!sale) return <div className="print-area" />

  const custName = sale.customerName || (customer && customer.name) || ''
  const custPhone = sale.customerPhone || (customer && customer.phone) || ''

  return (
    <div className="print-area">
      <div className="bill-header">
        <h2>{settings.shopName || 'Pesticide Store'}</h2>
        <div>{settings.address || ''}</div>
        <div>📞 {settings.phone || ''}</div>
      </div>
      <div style={{ fontSize: 13, color: '#000' }}>
        <div>
          Bill #{sale.id.slice(-6).toUpperCase()} &nbsp;|&nbsp; Date: {new Date(sale.date).toLocaleString()}
        </div>
        <div>Cashier: {sale.cashier}</div>
        {custName && (
          <div>
            Customer: {custName} {custPhone ? `(${custPhone})` : ''}
          </div>
        )}
        {sale.reference && <div>Reference: {sale.reference}</div>}
        <div>Payment: {sale.paymentType === 'ledger' ? 'Ledger (Credit)' : 'Cash'}{sale.settledImmediately ? ' (Paid in full)' : ''}</div>
      </div>
      <table className="bill-table" style={{ marginTop: 8 }}>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
        {sale.items.map((it, i) => (
          <tr key={i}>
            <td>{it.name}</td>
            <td>{it.qty}</td>
            <td>{money(it.price)}</td>
            <td>{money(it.price * it.qty)}</td>
          </tr>
        ))}
      </table>
      <div style={{ borderTop: '1px dashed #000', marginTop: 8, paddingTop: 6, color: '#000', fontSize: 13 }}>
        <div>Subtotal: {money(sale.subtotal)}</div>
        {sale.discount > 0 && <div>Discount: {money(sale.discount)}</div>}
        <div style={{ fontWeight: 'bold', fontSize: 16 }}>Grand Total: {money(sale.total)}</div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#000' }}>{settings.footer || ''}</div>
    </div>
  )
}
