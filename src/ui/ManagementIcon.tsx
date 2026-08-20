import type { CampaignId } from '../game/content/campaigns'
import type { UpgradeId } from '../game/content/upgrades'

export type ManagementIconName =
  | CampaignId
  | UpgradeId
  | 'contract'
  | 'equipment'
  | 'marketing'
  | 'upgrade'
  | 'reception'
  | 'furniture'
  | 'partition'
  | 'expansion'

interface Props {
  name: ManagementIconName
  className?: string
}

/**
 * Small line icons shared by the management apps.
 *
 * The game already has a strong illustrated equipment set, but the abstract
 * systems used emoji as placeholders. These deliberately stay simple and
 * inherit their card's colour, so the screens feel drawn by the same hand
 * without pretending that a campaign or an upgrade is a piece of 3D kit.
 */
export default function ManagementIcon({ name, className }: Props) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const drawing = (() => {
    switch (name) {
      case 'equipment':
        return <path d="M3 9v6m3-8v10m12-10v10m3-8v6M6 12h12" />
      case 'marketing':
        return <><path d="M4 13V8l12-4v13L4 13Z" /><path d="M8 14v5.5a2 2 0 0 0 4 0V15m6-7c1.4 1.2 1.4 3.8 0 5" /></>
      case 'contract':
        return <><path d="M6 3.5h8l4 4V21H6z" /><path d="M14 3.5V8h4M9 12h6M9 15.5h6" /></>
      case 'upgrade':
        return <><path d="m5 15 7-7 7 7" /><path d="m5 21 7-7 7 7M12 3v11" /></>
      case 'reception':
        return <><path d="M3 10h18v8H3zM6 18v3m12-3v3" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 3.5v4" /></>
      case 'furniture':
        return <><path d="M6 12V6h12v6M5 12h14a2 2 0 0 1 2 2v4H3v-4a2 2 0 0 1 2-2Z" /><path d="M6 18v3m12-3v3" /></>
      case 'partition':
        return <><path d="M4 4h16v15H4zM8 4v15m8-15v15M3 21h18" /><path d="M11 11h2" /></>
      case 'expansion':
        return <><path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5" /><path d="m4 4 5 5m11-5-5 5M4 20l5-5m11 5-5-5" /></>
      case 'cleaning':
        return <><path d="m16.5 3-7 12" /><path d="M7 13.5 12.5 17 9 22H3l1-6.5zM12.5 6.5l3 1.8" /></>
      case 'repair':
        return <><path d="M14.5 6.5a5 5 0 0 0-6.2 6.2L3.5 17.5a2.1 2.1 0 0 0 3 3l4.8-4.8a5 5 0 0 0 6.2-6.2l-3 3-3-3z" /><path d="m5 19 1-1" /></>
      case 'earnings':
        return <><path d="M4 20V9m6 11V4m6 16v-7m4 7H2" /><path d="m4 7 5-4 5 6 6-5" /></>
      case 'luck':
        return <><circle cx="8" cy="8" r="3.2" /><circle cx="16" cy="8" r="3.2" /><circle cx="8" cy="16" r="3.2" /><circle cx="16" cy="16" r="3.2" /><path d="m12 12 6 9" /></>
      case 'patience':
        return <><path d="M6 3h12M6 21h12M7 3c0 5 2 6 5 9-3 3-5 4-5 9m10-18c0 5-2 6-5 9 3 3 5 4 5 9" /><path d="M9 18h6" /></>
      case 'flyers':
        return <><path d="M7 4h11v14H7zM4 7v14h11" /><path d="M10 8h5m-5 3h5m-5 3h3" /></>
      case 'social':
        return <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10 6h4m-3 12h2" /><circle cx="12" cy="12" r="2.5" /></>
      case 'billboards':
        return <><path d="M3 5h18v11H3zM8 16v5m8-5v5M6 21h12" /><path d="m7 12 3-3 2 2 3-3 2 2" /></>
      case 'influencer':
        return <><circle cx="10" cy="8" r="3" /><path d="M4.5 19a5.5 5.5 0 0 1 11 0" /><path d="m18 4 .7 1.6L20.5 6l-1.8.6L18 8l-.7-1.4L15.5 6l1.8-.4z" /></>
      case 'tv':
        return <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m9 3 3 3 3-3M8 22h8" /><path d="m10 10 5 2.5-5 2.5z" /></>
    }
  })()

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...common}
    >
      {drawing}
    </svg>
  )
}
