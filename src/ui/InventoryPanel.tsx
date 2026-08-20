import type { InventoryItem } from '../game/types'
import { assetFor } from '../assets/assetFor'
import { useI18n, type I18n } from '../i18n'
import { useDialogFocus } from './useDialogFocus'

interface Props {
  items: InventoryItem[]
  /** What choosing an item will do, since the bag opens from two directions. */
  hint?: string
  onChoose: (itemUid: string) => void
  onClose: () => void
}

function label(item: InventoryItem, t: I18n['t']): string {
  if (item.kind === 'machine') return t.content.machines[item.type]
  if (item.kind === 'decor') return t.content.decor[item.type]
  return t.build.wall
}

function detail(item: InventoryItem, t: I18n['t']): string | null {
  if (item.kind !== 'machine') return null
  return item.durability >= 100
    ? t.inventory.asNew
    : t.inventory.condition(Math.round(item.durability))
}

function Thumb({ item, t }: { item: InventoryItem; t: I18n['t'] }) {
  if (item.kind === 'machine') {
    const Icon = assetFor(item.type)
    return <Icon />
  }
  // Decor and walls have no sprite of their own; a tinted initial reads well
  // enough at thumbnail size and costs nothing to maintain.
  return <div className="inv-glyph">{label(item, t).charAt(0)}</div>
}

/**
 * The bag, opened by clicking an empty tile. Choosing an item drops it on that
 * tile straight away — there is no separate confirm step, because the tile was
 * already chosen when the panel opened.
 */
export default function InventoryPanel({ items, hint, onChoose, onClose }: Props) {
  const { t } = useI18n()
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal inventory"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="inv-head">
          <h2 id="inventory-title">{t.inventory.title}</h2>
          <button className="btn ghost tiny" onClick={onClose}>
            {t.inventory.close}
          </button>
        </header>

        {items.length === 0 ? (
          <p className="hint">{t.inventory.empty}</p>
        ) : (
          <>
            {hint && <p className="hint">{hint}</p>}
            <div className="inv-grid">
              {items.map(item => (
                <button key={item.uid} className="inv-item" onClick={() => onChoose(item.uid)}>
                  <Thumb item={item} t={t} />
                  <span className="inv-name">{label(item, t)}</span>
                  {detail(item, t) && <span className="inv-detail">{detail(item, t)}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
