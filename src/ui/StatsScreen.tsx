import type { GameState } from '../game/types'
import { XP_PER_LEVEL } from '../game/constants'
import { dailyCosts, gymClass } from '../game/economy'
import { money } from './format'

function Card({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat-card">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  )
}

function Meter({ k, value }: { k: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="k">{k}</div>
      <div className="v">{Math.round(value)}</div>
      <div className="meter">
        <div className="meter-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

export default function StatsScreen({ state }: { state: GameState }) {
  return (
    <div className="screen">
      <h2 className="section-title">Siłownia</h2>
      <div className="stat-grid">
        <Meter k="Renoma" value={state.reputation} />
        <Meter k="Zadowolenie" value={state.satisfaction} />
        <Card k="Maszyny" v={String(state.machines.length)} />
        <Card k="Klasa" v={`×${gymClass(state).toFixed(2)}`} />
        <Card k="Członkowie" v={String(state.members.length)} />
        <Card k="Rachunek dzienny" v={money(dailyCosts(state).total)} />
      </div>

      <h2 className="section-title" style={{ marginTop: 16 }}>
        Bilans
      </h2>
      <div className="stat-grid">
        <Card k="Zarobiono" v={money(state.stats.totalEarned)} />
        <Card k="Wydano" v={money(state.stats.totalSpent)} />
        <Card k="Obsłużeni" v={String(state.stats.clientsServed)} />
        <Card k="Straceni" v={String(state.stats.clientsLost)} />
      </div>

      <h2 className="section-title" style={{ marginTop: 16 }}>
        Postęp
      </h2>
      <div className="stat-grid">
        <Card k="Poziom" v={String(state.level)} />
        <Card k="XP" v={`${Math.floor(state.xp)} / ${XP_PER_LEVEL}`} />
        <Card k="Dni" v={String(state.day)} />
        <Card k="Kasa" v={money(state.cash)} />
      </div>
    </div>
  )
}
