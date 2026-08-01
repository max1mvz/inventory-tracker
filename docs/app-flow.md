# Inventory Tracker — Application Flow

How a session moves from sign-in through the screens and into the append-only
stock loop. `movements` is the only writable ledger; `current_stock` is a
computed view (`products` + Σ `movements`), so quantities are never overwritten.

```mermaid
flowchart TD
  start([App loads]):::proc --> sess{Session valid?}:::gate
  sess -->|checking| load([Loading…]):::proc
  sess -->|no session| login[Login<br/>email + password]:::proc
  login -->|forgot| reset[Reset-password email]:::proc
  login -->|sign in| dev
  sess -->|signed in| dev{Desktop or mobile?}:::gate
  dev -->|desktop ≥1024px| shellD[Sidebar shell<br/>opens Overview]:::proc
  dev -->|mobile| shellM[Scan-first shell<br/>opens Scan]:::proc
  shellD --> ov
  shellM --> sc

  subgraph nav [Main navigation]
    ov[Overview]:::view
    sc[Scan · mobile]:::view
    st[Stock]:::view
    ac[Activity]:::view
    us[Users · admin]:::view
  end

  ov --> ovd["₱ value · units · low · out<br/>charts · by category · by reason<br/>reorder list · recent activity"]:::proc
  sc --> cam[Camera reads barcode]:::proc --> look
  st --> stl[Search · sort · Add product]:::proc
  st --> tap[Tap a product]:::proc --> look
  ov -.tap an item.-> look
  ac --> feed[Movement audit feed]:::proc
  us --> uadm[Invite · set role · remove]:::proc
  stl -->|Add product| create

  look{lookupProduct}:::gate
  look -->|found| card[Product drawer / card]:::view
  look -->|not found| create[Create-product form]:::proc

  card --> q1[+1 / −1]:::proc
  card --> q2[Custom amount + reason]:::proc
  card --> q3[Full recount]:::proc
  card --> ed[Edit details]:::proc
  card --> hi[View history]:::proc

  q1 --> rec
  q2 --> rec
  q3 --> rec
  rec[recordMovement]:::proc
  create --> cp[createProduct]:::proc --> card
  ed --> up[updateProduct]:::proc

  rec --> mv[("movements<br/>append-only ledger")]:::data
  cp --> pr[(products)]:::data
  up --> pr
  mv --> cs[["current_stock<br/>products + Σ movements"]]:::data
  pr --> cs
  cs --> rt{{Realtime · movements insert}}:::gate
  rt -.refresh.-> ov
  rt -.refresh.-> st
  rt -.refresh.-> card

  rec -.offline.-> idb[("IndexedDB<br/>cache + outbox")]:::data
  cp -.offline.-> idb
  idb -.flush on reconnect.-> mv

  classDef view fill:#4f46e5,stroke:#818cf8,color:#ffffff;
  classDef proc fill:#1b1f3a,stroke:#3a4170,color:#e7e9f7;
  classDef data fill:#0f2b23,stroke:#10b981,color:#bff3df;
  classDef gate fill:#241f47,stroke:#8b5cf6,color:#e7e9f7;
```

**Legend** — indigo = screen · navy = action/function · emerald = data store ·
violet = decision / event · dashed edge = offline queue or realtime refresh.

## Key invariants

- **Stock is append-only.** Every change is a signed row in `movements`
  (`received`, `sold`, `damaged`, `returned`, `count_adjustment`, `transfer`).
  There is no UPDATE/DELETE policy on the table — the ledger is permanent.
- **`current_stock` is computed**, never stored: `qty = Σ movements.delta`, and
  `needs_reorder = qty ≤ reorder_point`.
- **Products carry metadata only** (name, category, unit, reorder point, cost,
  price in ₱) — never a quantity. Created via the form, edited in the drawer.
- **Offline-first writes**: when the network is down, movements and creates queue
  in an IndexedDB outbox and flush automatically on reconnect.
- **Realtime**: a `movements` INSERT subscription refreshes every open view
  within ~1s, so all devices stay in sync.
