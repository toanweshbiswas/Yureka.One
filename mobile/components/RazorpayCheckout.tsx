import { colors } from '@/lib/theme'
import { Modal, View } from 'react-native'
import { WebView } from 'react-native-webview'

export type RazorpayCheckoutParams = {
  keyId: string
  amountPaise: number
  currency?: string
  razorpayOrderId: string
  name?: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
}

export function RazorpayCheckoutModal({
  visible,
  params,
  onSuccess,
  onCancel,
}: {
  visible: boolean
  params: RazorpayCheckoutParams | null
  onSuccess: (payload: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  onCancel: () => void
}) {
  if (!visible || !params) return null
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="background:#070707;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;color:#fff;font-family:-apple-system,sans-serif">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  var options = {
    key: ${JSON.stringify(params.keyId)},
    amount: ${JSON.stringify(params.amountPaise)},
    currency: ${JSON.stringify(params.currency || 'INR')},
    name: ${JSON.stringify(params.name || 'Yureka One')},
    description: ${JSON.stringify(params.description || 'Gift card')},
    order_id: ${JSON.stringify(params.razorpayOrderId)},
    prefill: ${JSON.stringify(params.prefill || {})},
    theme: { color: '#34d399' },
    handler: function (response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', response: response }));
    },
    modal: {
      ondismiss: function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cancel' }));
      }
    }
  };
  var rzp = new Razorpay(options);
  rzp.open();
</script>
</body></html>`

  return (
    <Modal visible animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <WebView
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://app.yureka.one' }}
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data)
              if (msg.type === 'success') onSuccess(msg.response)
              else onCancel()
            } catch {
              onCancel()
            }
          }}
        />
      </View>
    </Modal>
  )
}
