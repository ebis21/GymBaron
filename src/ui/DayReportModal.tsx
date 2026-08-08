import type { DayReport } from '../game/types'
import { useI18n } from '../i18n'

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
 * The receipt, shown once the player has cashed up of their own accord.
 * Deliberately modal with no dismiss: the till is counted, and the only way
 * forward is to open the gym again tomorrow.
 */
export default function DayReportModal({ report, onNextDay }: Props) {
  const { t, money } = useI18n()
  // Both totals have to add up the rows actually printed above them, or the
  // receipt contradicts itself the first day a campaign runs.
  const income = report.entryFees + report.subscriptions + report.sponsorIncome
  const totalDue = report.bill + report.wages + report.marketingSpend + report.contractFees
  const profit = report.net >= 0

  return (
    <div className="modal-backdrop">
      <div className="modal receipt">
        <header className="receipt-head">
          <span className="receipt-time">{t.report.closingTime}</span>
          <h2>{t.report.title(report.day)}</h2>
        </header>

        <section className="receipt-block">
          <h3>{t.report.income}</h3>
          <Row label={t.report.doorFees} value={money(report.entryFees)} tone="in" />
          {report.trainerFees > 0 && (
            <Row label={t.report.trainerFees} value={money(report.trainerFees)} tone="in" />
          )}
          <Row label={t.report.passes} value={money(report.subscriptions)} tone="in" />
          {/* Sponsorship is income like any other, so it belongs in this block
              rather than in a section of its own. It is only printed on a day
              a deal actually paid — an unsigned gym sees the receipt it always
              saw. The same holds for the two outgoings below. */}
          {report.sponsorIncome > 0 && (
            <Row label={t.sponsors.reportLine} value={money(report.sponsorIncome)} tone="in" />
          )}
          <div className="receipt-row total">
            <span>{t.report.total}</span>
            <span className="receipt-in">{money(income)}</span>
          </div>
        </section>

        {report.counterfeitLoss > 0 && (
          <section className="receipt-block receipt-counterfeit">
            <h3>{t.report.counterfeitTitle}</h3>
            <Row
              label={t.report.counterfeit}
              value={`−${money(report.counterfeitLoss)}`}
              tone="out"
            />
            <p>{t.report.counterfeitNote}</p>
          </section>
        )}

        <section className="receipt-block">
          <h3>{t.report.due}</h3>
          <Row label={t.report.rent} value={`−${money(report.rent)}`} tone="out" />
          <Row label={t.report.power} value={`−${money(report.power)}`} tone="out" />
          <Row label={t.report.memberUpkeep} value={`−${money(report.memberUpkeep)}`} tone="out" />
          <Row label={t.report.wages} value={`−${money(report.wages)}`} tone="out" />
          {report.marketingSpend > 0 && (
            <Row
              label={t.marketing.reportLine}
              value={`−${money(report.marketingSpend)}`}
              tone="out"
            />
          )}
          {report.contractFees > 0 && (
            <Row
              label={t.contracts.reportLine}
              value={`−${money(report.contractFees)}`}
              tone="out"
            />
          )}
          <div className="receipt-row total">
            <span>{t.report.bill}</span>
            <span className="receipt-out">−{money(totalDue)}</span>
          </div>
        </section>

        <div className={`receipt-net ${profit ? 'good' : 'bad'}`}>
          <span>{t.report.net}</span>
          <strong>
            {profit ? '+' : '−'}
            {money(Math.abs(report.net))}
          </strong>
        </div>

        <p className="receipt-cash">
          {t.report.cashLabel} {money(report.cashBefore)} →{' '}
          <strong>{money(report.cashAfter)}</strong>
        </p>

        <div className="receipt-stats">
          <span>{t.report.served(report.clientsServed)}</span>
          <span>{t.report.lost(report.clientsLost)}</span>
          <span>{t.report.signups(report.signups)}</span>
          {report.churn > 0 && <span className="receipt-out">{t.report.churn(report.churn)}</span>}
        </div>

        {report.clientsLost > 0 && (
          <p className="receipt-hint">{t.report.lostHint(report.clientsLost)}</p>
        )}

        <button className="btn primary block big" onClick={onNextDay}>
          {t.report.nextDay}
        </button>
      </div>
    </div>
  )
}
