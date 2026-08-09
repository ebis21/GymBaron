import type { CampaignId } from '../game/content/campaigns'

/**
 * Everything advertising puts on screen, in both languages.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * It lives apart from `en.ts`/`pl.ts` for one reason: those two files are the
 * single place all three v2 branches would otherwise be inserting keys at
 * once. Here the owner adds whatever they like, and the shared dictionaries
 * keep the one import line they already have.
 */
interface CampaignCopy {
  name: string
  blurb: string
}

export interface MarketingStrings {
  title: string
  /** The line on the day's receipt, shown only when something was spent. */
  reportLine: string
  hint: string
  activeTitle: string
  remainingClosings: (count: number) => string
  trafficTitle: string
  effect: (multiplier: number) => string
  billing: (price: string) => string
  schedule: (days: number, price: string) => string
  start: string
  running: string
  oneAtTime: string
  closed: string
  short: (amount: string) => string
  campaigns: Record<CampaignId, CampaignCopy>
}

export const marketingEn: MarketingStrings = {
  title: 'Advertising',
  reportLine: 'Advertising',
  hint:
    'Run one campaign at a time. It starts now, lasts through the listed closing days, and the daily fee lands on each receipt.',
  activeTitle: 'Live campaign',
  remainingClosings: count => `${count} closing${count === 1 ? '' : 's'} left`,
  trafficTitle: 'Walk-in traffic',
  effect: multiplier => `${multiplier.toFixed(2).replace(/0$/, '')}× arrivals`,
  billing: price => `${price} at every close`,
  schedule: (days, price) => `${days} days · ${price} / day`,
  start: 'Start',
  running: 'Live',
  oneAtTime: 'Another campaign is already live.',
  closed: 'The doors are closed. Start one tomorrow.',
  short: amount => `${amount} short for the first bill.`,
  campaigns: {
    flyers: {
      name: 'Neighbourhood flyers',
      blurb: 'Cheap local reach for a gym finding its first regular crowd.',
    },
    social: {
      name: 'Local social ads',
      blurb: 'A steady push across feeds, maps and nearby fitness groups.',
    },
    billboards: {
      name: 'City billboards',
      blurb: 'Expensive reach that pays only when a strong reputation backs it up.',
    },
  },
}

export const marketingPl: MarketingStrings = {
  title: 'Reklama',
  reportLine: 'Reklama',
  hint:
    'Prowadź jedną kampanię naraz. Startuje od razu, trwa przez podaną liczbę zamknięć, a opłata dzienna trafia na każdy paragon.',
  activeTitle: 'Aktywna kampania',
  remainingClosings: count => `Pozostałe zamknięcia: ${count}`,
  trafficTitle: 'Ruch z ulicy',
  effect: multiplier => `${multiplier.toFixed(2).replace('.', ',').replace(/0$/, '')}× wejść`,
  billing: price => `${price} przy każdym zamknięciu`,
  schedule: (days, price) => `${days} dni · ${price} / dzień`,
  start: 'Uruchom',
  running: 'Trwa',
  oneAtTime: 'Inna kampania już trwa.',
  closed: 'Drzwi są już zamknięte. Wróć jutro.',
  short: amount => `Do pierwszej opłaty brakuje ${amount}.`,
  campaigns: {
    flyers: {
      name: 'Ulotki na osiedlu',
      blurb: 'Tani lokalny zasięg dla siłowni, która zbiera pierwszą stałą ekipę.',
    },
    social: {
      name: 'Reklamy lokalne online',
      blurb: 'Stała promocja w socialach, mapach i pobliskich grupach fitness.',
    },
    billboards: {
      name: 'Billboardy w mieście',
      blurb: 'Drogi zasięg, który zwraca się dopiero przy mocnej reputacji.',
    },
  },
}
