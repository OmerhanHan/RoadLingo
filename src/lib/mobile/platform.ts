'use client'

import { Capacitor } from '@capacitor/core'

export type AppPlatform = 'ios' | 'android' | 'web'

export function getPlatform(): AppPlatform {
  const p = Capacitor.getPlatform()
  if (p === 'ios' || p === 'android') return p
  return 'web'
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

export async function initMobileShell(): Promise<void> {
  if (typeof document === 'undefined') return

  const platform = getPlatform()
  const root = document.documentElement
  root.classList.add(`platform-${platform}`)
  if (isNativePlatform()) {
    root.classList.add('platform-native')
  }

  if (!isNativePlatform()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
    if (platform === 'android') {
      await StatusBar.setOverlaysWebView({ overlay: true })
      await StatusBar.setBackgroundColor({ color: '#FAF6EF' })
    }
  } catch {
    // StatusBar plugin may be unavailable in web/preview contexts
  }
}
