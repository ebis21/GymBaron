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
export interface MarketingStrings {
  title: string
  /** The line on the day's receipt, shown only when something was spent. */
  reportLine: string
  /** Shown by the screen until the feature does something. */
  empty: string
}

export const marketingEn: MarketingStrings = {
  title: 'Marketing',
  reportLine: 'Advertising',
  empty: 'No campaigns running.',
}

export const marketingPl: MarketingStrings = {
  title: 'Marketing',
  reportLine: 'Reklama',
  empty: 'Żadna kampania nie jest w toku.',
}
