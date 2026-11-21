'use client'

import { useEffect } from 'react'
import { initMobileShell } from '@/lib/mobile/platform'

export default function MobileShellInit() {
  useEffect(() => {
    void initMobileShell()
  }, [])

  return null
}
