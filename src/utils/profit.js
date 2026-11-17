// Profit helpers shared by the Reports screen.
// Sales made after this update store a `cost` snapshot on every cart item
// (the product's purchase price at the moment it was sold), so profit stays
// accurate even if a product's purchase price changes later. For older
// sales recorded before this existed, we fall back to the product's current
// purchase price as a best-effort estimate.

export function itemCost(item, productsById) {
  if (typeof item.cost === 'number') return item.cost
  const p = productsById.get(item.productId)
  return p ? p.purchase || 0 : 0
}

export function saleCost(sale, productsById) {
  return (sale.items || []).reduce((sum, it) => sum + itemCost(it, productsById) * it.qty, 0)
}

export function saleProfit(sale, productsById) {
  return (sale.total || 0) - saleCost(sale, productsById)
}
