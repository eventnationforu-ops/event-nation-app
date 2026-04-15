import { useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT, RADIUS } from '../constants/theme';

const LOAD_TIMEOUT_MS = 15000;

function escapeForJs(str) {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n');
}

export default function RazorpayCheckout({
  visible,
  orderData,
  onSuccess,
  onFailure,
  onDismiss,
}) {
  const [loading, setLoading] = useState(true);
  const [webviewError, setWebviewError] = useState(null);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  if (!visible || !orderData) return null;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
<style>
body{background:#0F0F1A;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:-apple-system,sans-serif;color:#fff}
.msg{text-align:center;opacity:0.7;font-size:14px}
</style>
</head>
<body>
<p class="msg">Connecting to payment gateway...</p>
<script>
try {
  var options = {
    key: '${escapeForJs(orderData.key_id)}',
    amount: ${Number(orderData.amount) || 0},
    currency: '${escapeForJs(orderData.currency)}',
    name: 'Event Nation',
    description: 'Event Booking Payment',
    order_id: '${escapeForJs(orderData.order_id)}',
    prefill: {
      name: '${escapeForJs(orderData.prefill?.name)}',
      email: '${escapeForJs(orderData.prefill?.email)}',
      contact: '${escapeForJs(orderData.prefill?.contact)}'
    },
    theme: { color: '#6C63FF' },
    handler: function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SUCCESS',
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      }));
    },
    modal: {
      ondismiss: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DISMISSED' }));
      },
      escape: false,
      confirm_close: true
    }
  };
  var rzp = new Razorpay(options);
  rzp.on('payment.failed', function(response) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'FAILURE',
      error: response.error.description || response.error.reason || 'Payment failed'
    }));
  });
  rzp.open();
} catch(e) {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'FAILURE',
    error: 'Failed to initialize payment: ' + e.message
  }));
}
<\/script>
</body>
</html>`;

  function handleMessage(event) {
    clearTimer();
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'SUCCESS':
          onSuccess({
            razorpayOrderId: data.razorpay_order_id,
            razorpayPaymentId: data.razorpay_payment_id,
            razorpaySignature: data.razorpay_signature,
          });
          break;
        case 'FAILURE':
          onFailure(data.error || 'Payment failed');
          break;
        case 'DISMISSED':
          onDismiss();
          break;
      }
    } catch {
      // non-Razorpay messages (console logs, etc.)
    }
  }

  function handleLoadEnd() {
    setLoading(false);
    clearTimer();
    timerRef.current = setTimeout(() => {
      // If nothing happens after timeout, Razorpay may have failed to open
    }, LOAD_TIMEOUT_MS);
  }

  function handleWebViewError(syntheticEvent) {
    clearTimer();
    setLoading(false);
    setWebviewError(syntheticEvent.nativeEvent.description || 'Failed to load payment page');
  }

  function handleRetry() {
    setWebviewError(null);
    setLoading(true);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Complete Payment</Text>
          <View style={styles.headerAmount}>
            <Text style={styles.headerAmountText}>
              ₹{((orderData.amount || 0) / 100).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {webviewError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.errorTitle}>Connection Failed</Text>
            <Text style={styles.errorDescription}>{webviewError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={onDismiss}>
              <Text style={styles.cancelLinkText}>Cancel Payment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {loading && (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loaderText}>Loading payment gateway...</Text>
              </View>
            )}
            <WebView
              key={webviewError === null ? 'active' : 'retry'}
              source={{ html }}
              onMessage={handleMessage}
              onLoadEnd={handleLoadEnd}
              onError={handleWebViewError}
              onHttpError={handleWebViewError}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              mixedContentMode="always"
              startInLoadingState={false}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerAmount: {
    backgroundColor: COLORS.primary + '22',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  headerAmountText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: FONT.md,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: COLORS.background,
  },
  loaderText: {
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    fontSize: FONT.md,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorTitle: {
    fontSize: FONT.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  errorDescription: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT.base,
  },
  cancelLink: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
  },
  cancelLinkText: {
    color: COLORS.textMuted,
    fontSize: FONT.md,
  },
});
