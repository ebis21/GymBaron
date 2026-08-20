import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useI18nStore } from '../i18n'
import { en } from '../i18n/en'
import { pl } from '../i18n/pl'
import NicknameOnboarding from './NicknameOnboarding'

const render = () => renderToStaticMarkup(
  <NicknameOnboarding
    ready
    loading={false}
    saving={false}
    error={null}
    onChoose={vi.fn(async () => true)}
    onRetry={vi.fn()}
  />,
)

describe('NicknameOnboarding', () => {
  beforeEach(() => {
    useI18nStore.setState({ language: 'en', t: en, ready: true })
  })

  it('explains the public one-time nickname in English', () => {
    const html = render()
    expect(html).toContain('What should everyone call you?')
    expect(html).toContain('friends will search for')
    expect(html).toContain('can only be set once')
    expect(html).toContain('maxlength="20"')
  })

  it('follows the Polish language setting', () => {
    useI18nStore.setState({ language: 'pl', t: pl, ready: true })
    const html = render()
    expect(html).toContain('Jak mają Cię nazywać?')
    expect(html).toContain('znajomi będą mogli Cię wyszukać')
  })
})
