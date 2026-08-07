import type { GameState } from '../game/types'
import { XP_PER_LEVEL } from '../game/constants'
import { dailyCosts, gymClass } from '../game/economy'
import { useI18n } from '../i18n'

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
  const { t, money } = useI18n()

  return (
    <div className="screen">
      <h2 className="section-title">{t.stats.gym}</h2>
      <div className="stat-grid">
        <Meter k={t.stats.reputation} value={state.reputation} />
        <Meter k={t.stats.satisfaction} value={state.satisfaction} />
        <Card k={t.stats.machines} v={String(state.machines.length)} />
        <Card k={t.stats.gymClass} v={`×${gymClass(state).toFixed(2)}`} />
        <Card k={t.stats.members} v={String(state.members.length)} />
        <Card k={t.stats.dailyBill} v={money(dailyCosts(state).total)} />
      </div>

      <h2 className="section-title" style={{ marginTop: 16 }}>
        {t.stats.balance}
      </h2>
      <div className="stat-grid">
        <Card k={t.stats.earned} v={money(state.stats.totalEarned)} />
        <Card k={t.stats.spent} v={money(state.stats.totalSpent)} />
        <Card k={t.stats.served} v={String(state.stats.clientsServed)} />
        <Card k={t.stats.lost} v={String(state.stats.clientsLost)} />
      </div>

      <h2 className="section-title" style={{ marginTop: 16 }}>
        {t.stats.progress}
      </h2>
      <div className="stat-grid">
        <Card k={t.stats.level} v={String(state.level)} />
        <Card k={t.stats.xp} v={`${Math.floor(state.xp)} / ${XP_PER_LEVEL}`} />
        <Card k={t.stats.days} v={String(state.day)} />
        <Card k={t.stats.cash} v={money(state.cash)} />
      </div>
    </div>
  )
}
