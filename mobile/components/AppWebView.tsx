import { Banner } from '@/components/Ui'
import { useAuth } from '@/lib/auth'
import { NATIVE_UA_SUFFIX, dashboardUrl, sessionInjectScript } from '@/lib/webview'
import { colors } from '@/lib/theme'
import { useMemo, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { WebView } from 'react-native-webview'

export function AppWebView({ path }: { path: string }) {
  const { session } = useAuth()
  const uri = dashboardUrl(path)
  const injected = useMemo(() => sessionInjectScript(session), [session])
  const [error, setError] = useState<string | null>(null)

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {error ? (
        <View style={{ padding: 16 }}>
          <Banner text={error} tone="danger" />
        </View>
      ) : null}
      <WebView
        source={{ uri }}
        style={{ flex: 1, backgroundColor: colors.bg }}
        applicationNameForUserAgent={NATIVE_UA_SUFFIX.trim()}
        injectedJavaScriptBeforeContentLoaded={injected}
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.clay} />
          </View>
        )}
        onError={() => setError('Could not load Yureka. Check your connection and try again.')}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode === 401) setError('Please sign in again')
          else if (e.nativeEvent.statusCode >= 500) setError('Yureka is temporarily unavailable')
        }}
        onLoadEnd={() => setError(null)}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
      />
    </View>
  )
}
