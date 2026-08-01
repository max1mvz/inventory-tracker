import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listStock, movementsSince, onProductsChanged } from '../data/inventory'
import { peso } from '../format'
import { useRealtimeMovements } from '../data/useRealtimeMovements'
import { useProductView } from '../product/ProductViewContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { useTeamDirectory } from '../data/useTeamDirectory'
import StatTiles from './StatTiles.jsx'
import MovementsChart from './MovementsChart.jsx'
import TopMoversChart from './TopMoversChart.jsx'
import CategoryBreakdown from './CategoryBreakdown.jsx'
import ReasonBreakdown from './ReasonBreakdown.jsx'
import MovementRanking from './MovementRanking.jsx'
import MovementRow from '../history/MovementRow.jsx'
import '../history/history.css'
import './dashboard.css'

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export default function Overview() {
  const { user } = useAuth()
  const { nameFor, emailFor } = useTeamDirectory(user?.id)
  const { openProduct } = useProductView()
  const [stock, setStock] = useState([])
  const [moves, setMoves] = useState([])
  const [loading, setLoading] = useState(true)
  const [movesOffline, setMovesOffline] = useState(false)
  const timer = useRef(null)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [stockRes] = await Promise.allSettled([listStock()])
    if (stockRes.status === 'fulfilled') setStock(stockRes.value)
    try {
      setMoves(await movementsSince(since))
      setMovesOffline(false)
    } catch {
      setMovesOffline(true) // movements are online-only
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Refresh when a product is created / edited / deleted on this device.
  useEffect(() => onProductsChanged(load), [load])

  useRealtimeMovements(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(load, 400)
  })
  useEffect(() => () => clearTimeout(timer.current), [])

  const model = useMemo(() => {
    const unitsInStock = stock.reduce((s, r) => s + (r.qty || 0), 0)
    const inventoryValue = stock.reduce((s, r) => s + (r.qty || 0) * (r.cost || 0), 0)
    const retailValue = stock.reduce((s, r) => s + (r.qty || 0) * (r.price || 0), 0)
    const lowStock = stock.filter((r) => r.needs_reorder)
    const outOfStock = stock.filter((r) => (r.qty || 0) <= 0)

    // Reorder list: every low-stock item with a suggested order quantity
    // (enough to refill to the reorder point, min 1). Out-of-stock first, then
    // by the biggest shortfall.
    const reorder = lowStock
      .map((r) => ({
        ...r,
        suggested: Math.max((r.reorder_point || 0) - (r.qty || 0), 1),
      }))
      .sort(
        (a, b) =>
          Number((a.qty || 0) > 0) - Number((b.qty || 0) > 0) ||
          b.suggested - a.suggested,
      )

    // Roll up the catalog by category: SKU count, units in stock, low-stock count.
    const catMap = new Map()
    for (const r of stock) {
      const name = r.category || 'Uncategorized'
      const c = catMap.get(name) || { name, count: 0, units: 0, value: 0, low: 0 }
      c.count += 1
      c.units += r.qty || 0
      c.value += (r.qty || 0) * (r.cost || 0)
      if (r.needs_reorder) c.low += 1
      catMap.set(name, c)
    }
    const categories = [...catMap.values()].sort(
      (a, b) => b.value - a.value || a.name.localeCompare(b.name),
    )

    const startToday = new Date()
    startToday.setHours(0, 0, 0, 0)
    const movementsToday = moves.filter(
      (m) => new Date(m.created_at) >= startToday,
    ).length

    // 7-day buckets, oldest → newest.
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      days.push({
        key: dayKey(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        received: 0,
        removed: 0,
      })
    }
    const byKey = Object.fromEntries(days.map((d) => [d.key, d]))
    for (const m of moves) {
      const bucket = byKey[dayKey(new Date(m.created_at))]
      if (!bucket) continue
      if (m.delta > 0) bucket.received += m.delta
      else bucket.removed += -m.delta
    }

    // Top movers over the whole 30-day window.
    const nameFor = Object.fromEntries(stock.map((r) => [r.barcode, r.name]))
    const vol = {}
    for (const m of moves) {
      vol[m.barcode] = (vol[m.barcode] || 0) + Math.abs(m.delta)
    }
    const movers = Object.entries(vol)
      .map(([barcode, total]) => ({
        barcode,
        total,
        name: nameFor[barcode] || moves.find((m) => m.barcode === barcode)?.products?.name || barcode,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    // The two ends of the 30-day window, across the WHOLE catalog (not just
    // products that moved) so dead stock surfaces. Idle items are ranked by the
    // money tied up in them.
    const ranked = stock.map((r) => ({
      barcode: r.barcode,
      name: r.name,
      qty: r.qty || 0,
      value: (r.qty || 0) * (r.cost || 0),
      moved: vol[r.barcode] || 0,
      last: r.last_movement,
    }))
    const topMoving = ranked
      .filter((r) => r.moved > 0)
      .sort((a, b) => b.moved - a.moved)
      .slice(0, 10)
    const notMoving = [...ranked]
      .sort((a, b) => a.moved - b.moved || b.value - a.value || b.qty - a.qty)
      .slice(0, 10)

    // Movements split by reason over the 30-day window (units + move count).
    const reasonMap = new Map()
    for (const m of moves) {
      const r = reasonMap.get(m.reason) || { reason: m.reason, units: 0, count: 0 }
      r.units += Math.abs(m.delta)
      r.count += 1
      reasonMap.set(m.reason, r)
    }
    const reasons = [...reasonMap.values()].sort((a, b) => b.units - a.units)

    return {
      tiles: [
        {
          label: 'Inventory value',
          value: peso(inventoryValue),
          icon: 'stock',
          sub: `${peso(retailValue)} retail value`,
        },
        {
          label: 'Units in stock',
          value: unitsInStock,
          icon: 'layers',
          sub: `across ${stock.length} product${stock.length === 1 ? '' : 's'}`,
        },
        {
          label: 'Products',
          value: stock.length,
          icon: 'layers',
          sub: `in ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`,
        },
        {
          label: 'Low stock',
          value: lowStock.length,
          tone: lowStock.length ? 'danger' : '',
          icon: 'alert',
          sub: lowStock.length ? 'need reordering' : 'all stocked',
          subTone: lowStock.length ? 'danger' : 'good',
        },
        {
          label: 'Out of stock',
          value: outOfStock.length,
          tone: outOfStock.length ? 'danger' : '',
          icon: 'alert',
          sub: outOfStock.length ? 'at zero units' : 'nothing at zero',
          subTone: outOfStock.length ? 'danger' : 'good',
        },
        {
          label: 'Movements today',
          value: movesOffline ? '—' : movementsToday,
          icon: 'activity',
          sub: movesOffline ? 'offline' : 'recorded today',
        },
      ],
      days,
      movers,
      topMoving,
      notMoving,
      categories,
      reasons,
      reorder,
      recent: moves.slice(0, 8),
    }
  }, [stock, moves, movesOffline])

  if (loading) {
    return (
      <div className="looking">
        <span className="spinner" /> Loading dashboard…
      </div>
    )
  }

  return (
    <div className="dashboard">
      <StatTiles tiles={model.tiles} />

      <div className="dash-charts">
        <div className="panel">
          <MovementsChart data={model.days} />
        </div>
        <div className="panel">
          <TopMoversChart movers={model.movers} />
        </div>
      </div>

      <div className="panel">
        <MovementRanking
          moving={model.topMoving}
          idle={model.notMoving}
          onPick={openProduct}
        />
      </div>

      <div className="dash-columns">
        <div className="dash-col">
          <div className="panel">
            <CategoryBreakdown categories={model.categories} />
          </div>

          <section className="panel">
          <div className="panel-head">
            <h3>Reorder list</h3>
            {model.reorder.length > 0 && (
              <span className="low-pill">{model.reorder.length}</span>
            )}
          </div>
          {model.reorder.length === 0 ? (
            <p className="chart-empty">Nothing needs reordering. 🎉</p>
          ) : (
            <ul className="lowstock-list">
              {model.reorder.map((r) => (
                <li key={r.barcode}>
                  <button
                    className={`lowstock-row ${(r.qty || 0) <= 0 ? 'out' : ''}`}
                    onClick={() => openProduct(r.barcode)}
                  >
                    <span className="ls-main">
                      <span className="ls-name">{r.name}</span>
                      <span className="ls-meta">
                        {(r.qty || 0) <= 0 ? (
                          <span className="ls-out-tag">Out of stock</span>
                        ) : (
                          <>
                            {r.qty} / {r.reorder_point} {r.unit} in stock
                          </>
                        )}
                      </span>
                    </span>
                    <span className="ls-order">
                      <strong>+{r.suggested}</strong>
                      <span className="ls-order-lbl">to order</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          </section>
        </div>

        <div className="dash-col">
          <div className="panel">
            <ReasonBreakdown reasons={model.reasons} />
          </div>

          <section className="panel">
          <div className="panel-head">
            <h3>Recent activity</h3>
          </div>
          {movesOffline ? (
            <p className="chart-empty">Activity is unavailable offline.</p>
          ) : model.recent.length === 0 ? (
            <p className="chart-empty">No movements recorded yet.</p>
          ) : (
            <ul className="mv-list">
              {model.recent.map((m) => (
                <MovementRow
                  key={m.id}
                  delta={m.delta}
                  reason={m.reason}
                  note={m.note}
                  created_at={m.created_at}
                  productName={m.products?.name || m.barcode}
                  mine={m.user_id === user?.id}
                  who={nameFor(m.user_id)}
                  whoEmail={emailFor(m.user_id)}
                />
              ))}
            </ul>
          )}
          </section>
        </div>
      </div>
    </div>
  )
}
