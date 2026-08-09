/**
 * Everything sponsorship puts on screen, in both languages.
 *
 * OWNER: `feat/v2-sponsors`. Nobody else edits this file.
 */
export interface SponsorStrings {
  title: string
  /** The line on the day's receipt, shown only when a deal paid out. */
  reportLine: string
  /** Shown by the screen until the feature does something. */
  empty: string
}

export const sponsorsEn: SponsorStrings = {
  title: 'Sponsors',
  reportLine: 'Sponsorship',
  empty: 'No deals on the table.',
}

export const sponsorsPl: SponsorStrings = {
  title: 'Sponsorzy',
  reportLine: 'Sponsoring',
  empty: 'Brak umów na stole.',
}
