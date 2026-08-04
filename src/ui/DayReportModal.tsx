import type { DayReport } from '../game/types'
import { money } from './format'

interface Props {
  report: DayReport
  onNextDay: () => void
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'in' | 'out' }) {
  return (
    <div className="receipt-row">
      <span>{label}</span>
      <span className={tone ? `receipt-${tone}` : undefined}>{value}</span>
    </div>
  )
}

/**
 * The 20:00 receipt. Deliberately modal with no dismiss: the day is over, and
 * the only way forward is to open the gym again tomorrow.
 */
export default function DayReportModal({ report, onNextDay }: Props) {
  const income = report.entryFees + report.subscriptions
  const totalDue = report.bill + report.wages
  const profit = report.net >= 0

  return (
    <div className="modal-backdrop">
      <div className="modal receipt">
        <header className="receipt-head">
          <span className="receipt-time">20:00 — zamknięcie</span>
          <h2>Rachunek za dzień {report.day}</h2>
        </header>

        <section className="receipt-block">
          <h3>Przychód</h3>
          <Row label="Wejściówki" value={money(report.entryFees)} tone="in" />
          <Row label="Karnety" value={money(report.subscriptions)} tone="in" />
          <div className="receipt-row total">
            <span>Razem</span>
            <span className="receipt-in">{money(income)}</span>
          </div>
        </section>

        <section className="receipt-block">
          <h3>Do zapłaty</h3>
          <Row label="Czynsz" value={`−${money(report.rent)}`} tone="out" />
          <Row label="Prąd" value={`−${money(report.power)}`} tone="out" />
          <Row label="Utrzymanie członków" value={`−${money(report.memberUpkeep)}`} tone="out" />
          <Row label="Wypłaty" value={`−${money(report.wages)}`} tone="out" />
          <div className="receipt-row total">
            <span>Rachunek</span>
            <span className="receipt-out">−{money(totalDue)}</span>
          </div>
        </section>

        <div className={`receipt-net ${profit ? 'good' : 'bad'}`}>
          <span>Bilans dnia</span>
          <strong>
            {profit ? '+' : '−'}
            {money(Math.abs(report.net))}
          </strong>
        </div>

        <p className="receipt-cash">
          Kasa: {money(report.cashBefore)} → <strong>{money(report.cashAfter)}</strong>
        </p>

        <div className="receipt-stats">
          <span>Obsłużeni: {report.clientsServed}</span>
          <span>Straceni: {report.clientsLost}</span>
          <span>Nowi członkowie: +{report.signups}</span>
          {report.churn > 0 && <span className="receipt-out">Odeszli: −{report.churn}</span>}
        </div>

        {report.clientsLost > 0 && (
          <p className="receipt-hint">
            {report.clientsLost === 1
              ? 'Jeden klient wyszedł'
              : `${report.clientsLost} klientów wyszło`}{' '}
            bez treningu. Każdy niezeskanowany to przepadła wejściówka i szansa na karnet.
          </p>
        )}

        <button className="btn primary block big" onClick={onNextDay}>
          Następny dzień →
        </button>
      </div>
    </div>
  )
}
