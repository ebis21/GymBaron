import type { Client, GameState, Machine, MachineTypeId } from '../game/types'
import { GRID_H, GRID_W, PATIENCE_MS } from '../game/constants'
import { machineType } from '../game/content/machines'
import { assetFor } from '../assets/assetFor'
import { money } from './format'

interface Props {
  state: GameState
  pending: MachineTypeId | null
  onScan: (clientUid: string) => void
  onPlace: (x: number, y: number) => void
  onRepair: (machineUid: string) => void
  onCancelPending: () => void
}

function QueueCard({ client, onScan }: { client: Client; onScan: (uid: string) => void }) {
  const Icon = assetFor('client')
  const left = Math.max(0, 1 - client.phaseMs / PATIENCE_MS)
  return (
    <button className="client-card" onClick={() => onScan(client.uid)} aria-label="Zeskanuj klienta">
      <Icon />
      <div className="patience">
        <div
          className={`patience-fill${left < 0.34 ? ' low' : ''}`}
          style={{ width: `${left * 100}%` }}
        />
      </div>
      <span className="client-label">Skanuj</span>
    </button>
  )
}

function Tile({
  machine,
  placeable,
  onPlace,
}: {
  machine: Machine | undefined
  placeable: boolean
  onPlace: () => void
}) {
  if (!machine) {
    const Floor = assetFor('floor')
    return (
      <button
        className={`tile empty${placeable ? ' placeable' : ''}`}
        onClick={onPlace}
        aria-label={placeable ? 'Postaw maszynę tutaj' : 'Puste miejsce'}
      >
        <Floor />
      </button>
    )
  }

  const spec = machineType(machine.type)
  const Icon = assetFor(machine.type)
  const broken = machine.durability <= 0
  const pct = machine.durability
  const barClass = broken ? 'dead' : pct < 35 ? 'worn' : ''

  return (
    <div
      className={`tile${machine.occupiedBy ? ' busy' : ''}${broken ? ' broken' : ''}`}
      title={`${spec.name} — ${Math.round(pct)}%`}
    >
      <Icon />
      <div className="durability">
        <div className={`durability-fill ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function GymScreen({
  state,
  pending,
  onScan,
  onPlace,
  onRepair,
  onCancelPending,
}: Props) {
  const byPos = new Map(state.machines.map(m => [`${m.x},${m.y}`, m]))
  const queue = state.clients.filter(c => c.phase === 'queue')
  const broken = state.machines.filter(m => m.durability <= 0)

  return (
    <div className="screen">
      {pending && (
        <>
          <p className="hint">
            Wybierz wolne pole dla: <strong>{machineType(pending).name}</strong>
          </p>
          <button className="btn ghost block" onClick={onCancelPending} style={{ marginBottom: 12 }}>
            Anuluj stawianie
          </button>
        </>
      )}

      <h2 className="section-title">Kolejka ({queue.length})</h2>
      {queue.length === 0 ? (
        <p className="queue-empty">
          {state.machines.length === 0
            ? 'Pusta sala nikogo nie przyciągnie. Kup pierwszą maszynę w sklepie.'
            : 'Nikt jeszcze nie czeka. Klienci przyjdą sami.'}
        </p>
      ) : (
        <div className="queue">
          {queue.map(c => (
            <QueueCard key={c.uid} client={c} onScan={onScan} />
          ))}
        </div>
      )}

      <h2 className="section-title">Sala</h2>
      <div className="grid-wrap">
        <div className="grid">
          {Array.from({ length: GRID_H }, (_, y) =>
            Array.from({ length: GRID_W }, (_, x) => (
              <Tile
                key={`${x},${y}`}
                machine={byPos.get(`${x},${y}`)}
                placeable={pending !== null && !byPos.has(`${x},${y}`)}
                onPlace={() => onPlace(x, y)}
              />
            )),
          )}
        </div>
      </div>

      {broken.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 16 }}>
            Do naprawy
          </h2>
          <div className="repair-list">
            {broken.map(m => {
              const spec = machineType(m.type)
              const Icon = assetFor(m.type)
              const affordable = state.cash >= spec.repairCost
              return (
                <div className="repair-row" key={m.uid}>
                  <Icon />
                  <span className="name">{spec.name}</span>
                  <button
                    className="btn"
                    disabled={!affordable}
                    onClick={() => onRepair(m.uid)}
                  >
                    Napraw {money(spec.repairCost)}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
