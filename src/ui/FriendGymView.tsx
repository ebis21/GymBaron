import { useEffect, useMemo, useState } from 'react'
import { expansionAt } from '../game/content/expansion'
import type {
  FriendFloorSnapshot,
  FriendGymSnapshot,
} from '../multiplayer/types'
import { useI18n } from '../i18n'
import './multiplayer.css'

interface Props {
  snapshot: FriendGymSnapshot
  onBack: () => void
}

function GymFloor({ floor }: { floor: FriendFloorSnapshot }) {
  const { t } = useI18n()
  const copy = t.club.friendGym
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
      aria-label={copy.layout(dimensions.w, dimensions.h)}
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
          ? t.content.machines[machine.type]
          : decoration
            ? t.content.decor[decoration.type]
            : ''
        return (
          <div
            className={`friend-gym-cell${northWall ? ' wall-n' : ''}${westWall ? ' wall-w' : ''}`}
            key={`${cell.x}:${cell.y}`}
          >
            {item && (
              <span
                className={`friend-gym-item ${machine ? 'machine' : 'decor'}`}
                title={machine ? copy.condition(label, Math.round(machine.durability)) : label}
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
  const { t } = useI18n()
  const copy = t.club.friendGym
  const floorName = (index: number) => index === 0 ? t.floors.ground : t.floors.numbered(index)
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
    <section className="multiplayer-screen friend-gym-view" aria-label={copy.aria}>
      <header className="multiplayer-heading">
        <button className="btn ghost tiny" type="button" onClick={onBack}>← {copy.back}</button>
        <div>
          <p className="multiplayer-eyebrow">{copy.readOnly}</p>
          <h2 className="section-title">{copy.title(snapshot.owner.username)}</h2>
        </div>
      </header>

      <div className="friend-gym-stats">
        <div><span>{t.stats.level}</span><strong>{snapshot.level}</strong></div>
        <div><span>{t.stats.reputation}</span><strong>{Math.round(snapshot.reputation)}</strong></div>
        <div><span>{t.stats.satisfaction}</span><strong>{Math.round(snapshot.satisfaction)}</strong></div>
        <div><span>{copy.floors}</span><strong>{snapshot.floors.length}</strong></div>
      </div>

      <nav className="friend-floor-tabs" aria-label={copy.floorTabs}>
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
            <span>{t.content.expansions[expansionAt(floor.expansion).id]}</span>
            <span>{copy.machines(floor.machines.length)}</span>
            <span>{copy.decor(floor.decor.length)}</span>
            <span>{copy.walls(floor.walls.length)}</span>
          </div>
          <GymFloor floor={floor} />
          <div className="friend-gym-legend" aria-label={copy.legend}>
            <span><i className="machine" /> {copy.machine}</span>
            <span><i className="decor" /> {copy.decoration}</span>
            <span><i className="wall" /> {copy.wall}</span>
          </div>
        </div>
      ) : (
        <p className="multiplayer-empty">{copy.empty}</p>
      )}
    </section>
  )
}
