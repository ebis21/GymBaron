import { useEffect, useMemo, useState } from 'react'
import { expansionAt } from '../game/content/expansion'
import type {
  FriendDecor,
  FriendFloorSnapshot,
  FriendGymSnapshot,
  FriendMachine,
} from '../multiplayer/types'
import './multiplayer.css'

interface Props {
  snapshot: FriendGymSnapshot
  onBack: () => void
}

const MACHINE_LABELS: Record<FriendMachine['type'], string> = {
  dumbbells: 'Hantle',
  bench: 'Ławka',
  treadmill: 'Bieżnia',
  latpulldown: 'Wyciąg',
  bike: 'Rower',
  cable: 'Brama',
}

const DECOR_LABELS: Record<FriendDecor['type'], string> = {
  plant: 'Roślina',
  reception: 'Recepcja',
  locker: 'Szafka',
  watercooler: 'Woda',
}

const floorName = (index: number) => index === 0 ? 'Parter' : `${index}. piętro`

function GymFloor({ floor }: { floor: FriendFloorSnapshot }) {
  const dimensions = expansionAt(floor.expansion)
  const cells = useMemo(
    () => Array.from({ length: dimensions.w * dimensions.h }, (_, index) => ({
      x: index % dimensions.w,
      y: Math.floor(index / dimensions.w),
    })),
    [dimensions.h, dimensions.w],
  )

  return (
    <div
      className="friend-gym-grid"
      style={{ gridTemplateColumns: `repeat(${dimensions.w}, minmax(30px, 1fr))` }}
      aria-label={`Plan: ${dimensions.w} na ${dimensions.h} pól`}
    >
      {cells.map(cell => {
        const machine = floor.machines.find(item => item.x === cell.x && item.y === cell.y)
        const decoration = floor.decor.find(item => item.x === cell.x && item.y === cell.y)
        const northWall = floor.walls.some(wall => (
          wall.x === cell.x && wall.y === cell.y && wall.side === 'n'
        ))
        const westWall = floor.walls.some(wall => (
          wall.x === cell.x && wall.y === cell.y && wall.side === 'w'
        ))
        const item = machine ?? decoration
        const label = machine
          ? MACHINE_LABELS[machine.type]
          : decoration
            ? DECOR_LABELS[decoration.type]
            : ''
        return (
          <div
            className={`friend-gym-cell${northWall ? ' wall-n' : ''}${westWall ? ' wall-w' : ''}`}
            key={`${cell.x}:${cell.y}`}
          >
            {item && (
              <span
                className={`friend-gym-item ${machine ? 'machine' : 'decor'}`}
                title={machine ? `${label} · stan ${Math.round(machine.durability)}%` : label}
              >
                {label.slice(0, 2)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function FriendGymView({ snapshot, onBack }: Props) {
  const initialFloor = snapshot.floors.some(floor => floor.index === snapshot.activeFloor)
    ? snapshot.activeFloor
    : (snapshot.floors[0]?.index ?? 0)
  const [floorIndex, setFloorIndex] = useState(initialFloor)

  useEffect(() => {
    if (!snapshot.floors.some(floor => floor.index === floorIndex)) {
      setFloorIndex(snapshot.floors[0]?.index ?? 0)
    }
  }, [floorIndex, snapshot])

  const floor = snapshot.floors.find(item => item.index === floorIndex) ?? snapshot.floors[0]

  return (
    <section className="multiplayer-screen friend-gym-view" aria-label="Siłownia znajomego">
      <header className="multiplayer-heading">
        <button className="btn ghost tiny" type="button" onClick={onBack}>← Wróć</button>
        <div>
          <p className="multiplayer-eyebrow">Podgląd tylko do odczytu</p>
          <h2 className="section-title">Siłownia: {snapshot.owner.username}</h2>
        </div>
      </header>

      <div className="friend-gym-stats">
        <div><span>Poziom</span><strong>{snapshot.level}</strong></div>
        <div><span>Reputacja</span><strong>{Math.round(snapshot.reputation)}</strong></div>
        <div><span>Satysfakcja</span><strong>{Math.round(snapshot.satisfaction)}</strong></div>
        <div><span>Piętra</span><strong>{snapshot.floors.length}</strong></div>
      </div>

      <nav className="friend-floor-tabs" aria-label="Piętra siłowni">
        {snapshot.floors.map(item => (
          <button
            className={`btn tiny${item.index === floorIndex ? '' : ' ghost'}`}
            type="button"
            key={item.index}
            onClick={() => setFloorIndex(item.index)}
          >
            {floorName(item.index)}
          </button>
        ))}
      </nav>

      {floor ? (
        <div className="friend-floor-card">
          <div className="friend-floor-meta">
            <strong>{floorName(floor.index)}</strong>
            <span>{expansionAt(floor.expansion).name}</span>
            <span>{floor.machines.length} maszyn</span>
            <span>{floor.decor.length} dekoracji</span>
            <span>{floor.walls.length} ścian</span>
          </div>
          <GymFloor floor={floor} />
          <div className="friend-gym-legend" aria-label="Legenda">
            <span><i className="machine" /> maszyna</span>
            <span><i className="decor" /> dekoracja</span>
            <span><i className="wall" /> ściana</span>
          </div>
        </div>
      ) : (
        <p className="multiplayer-empty">Ten zapis nie zawiera jeszcze planu piętra.</p>
      )}
    </section>
  )
}
