import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readProjectFile = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('mobile orientation configuration', () => {
  it('allows portrait and both landscape directions on iPhone', () => {
    const plist = readProjectFile('ios/App/App/Info.plist')
    const orientations = plist.match(
      /<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/,
    )?.[1]

    expect(orientations).toContain('UIInterfaceOrientationPortrait')
    expect(orientations).toContain('UIInterfaceOrientationLandscapeLeft')
    expect(orientations).toContain('UIInterfaceOrientationLandscapeRight')
  })

  it('does not lock the Android activity to portrait', () => {
    const manifest = readProjectFile('android/app/src/main/AndroidManifest.xml')

    expect(manifest).not.toMatch(/android:screenOrientation\s*=/)
  })

  it('lets an installed web app follow the device orientation', () => {
    const manifest = JSON.parse(readProjectFile('public/manifest.webmanifest')) as {
      orientation?: string
    }

    expect(manifest.orientation).toBe('any')
  })
})
