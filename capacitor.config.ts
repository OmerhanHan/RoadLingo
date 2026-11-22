import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAPACITOR_SERVER_URL

const config: CapacitorConfig = {
  appId: 'com.roadlingo.app',
  appName: 'RoadDash',
  webDir: 'out',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
        },
      }
    : {
        server: {
          androidScheme: 'https',
        },
      }),
  ios: {
    contentInset: 'never',
    backgroundColor: '#FAF6EF',
    allowsLinkPreview: false,
  },
  android: {
    backgroundColor: '#FAF6EF',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#FAF6EF',
    },
  },
}

export default config
