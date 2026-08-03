import type { InventoryItem } from '../game/types'
import { machineType } from '../game/content/machines'
import { decorType } from '../game/content/decor'
import { assetFor } from '../assets/assetFor'

interface Props {
  items: InventoryItem[]
  /** What choosing an item will do, since the bag opens from two directions. */
  hint?: string
  onChoose: (itemUid: string) => void
  onClose: () => void
}

function label(item: InventoryItem): string {
  if (item.kind === 'machine') return machineType(item.type).name
  if (item.kind === 'decor') return decorType(item.type).name
  return 'Ścianka'
}

function detail(item: InventoryItem): string | null {
  if (item.kind !== 'machine') return null
  return item.durability >= 100 ? 'Jak nowa' : `Stan ${Math.round(item.durability)}%`
}

function Thumb({ item }: { item: InventoryItem }) {
  if (item.kind === 'machine') {
    const Icon = assetFor(item.type)
    return <Icon />
  }
  // Decor and walls have no sprite of their own; a tinted initial reads well
  // enough at thumbnail size and costs nothing to maintain.
  return <div className="inv-glyph">{label(item).charAt(0)}</div>
}

/**
 * The bag, opened by clicking an empty tile. Choosing an item drops it on that
 * tile straight away — there is no separate confirm step, because the tile was
 * already chosen when the panel opened.
 */
export default function InventoryPanel({ items, hint, onChoose, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal inventory" onClick={e => e.stopPropagation()}>
        <header className="inv-head">
          <h2>Ekwipunek</h2>
          <button className="btn ghost tiny" onClick={onClose}>
            Zamknij
          </button>
        </header>

        {items.length === 0 ? (
          <p className="hint">
            Pusto. Kup sprzęt albo meble w sklepie — wszystko, co kupisz, ląduje
            tutaj i czeka, aż wskażesz mu miejsce.
          </p>
        ) : (
          <>
            {hint && <p className="hint">{hint}</p>}
            <div className="inv-grid">
              {items.map(item => (
                <button key={item.uid} className="inv-item" onClick={() => onChoose(item.uid)}>
                  <Thumb item={item} />
                  <span className="inv-name">{label(item)}</span>
                  {detail(item) && <span className="inv-detail">{detail(item)}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
