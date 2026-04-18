// src/components/RazorpayWebView.tsx
import React, { useRef } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity,
         Text, ActivityIndicator, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  visible: boolean;
  orderId: string;
  amount: number;       // in ₹
  keyId: string;
  userName: string;
  userEmail: string;
  onSuccess: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onFailure: (reason: string) => void;
  onDismiss: () => void;
}

export default function RazorpayWebView({
  visible, orderId, amount, keyId,
  userName, userEmail,
  onSuccess, onFailure, onDismiss,
}: Props) {
  const webRef = useRef<WebView>(null);

  // Inline HTML page that loads Razorpay checkout JS
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, sans-serif;
          background: #0f172a;
          display: flex; align-items: center;
          justify-content: center; height: 100vh;
        }
        .loader {
          color: #22d3ee; font-size: 16px; text-align: center;
        }
        .dot { animation: blink 1s infinite; }
        @keyframes blink { 50% { opacity: 0; } }
      </style>
    </head>
    <body>
      <div class="loader">
        Opening Payment<span class="dot">...</span>
      </div>
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <script>
        window.onload = function() {
          var options = {
            key:         "${keyId}",
            amount:      ${amount * 100},
            currency:    "INR",
            name:        "VoltStartEV",
            description: "Wallet Load",
            order_id:    "${orderId}",
            prefill: {
              name:  "${userName}",
              email: "${userEmail}",
            },
            theme: { color: "#22d3ee" },
            modal: {
              ondismiss: function() {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: 'DISMISSED' })
                );
              }
            },
            handler: function(response) {
              window.ReactNativeWebView.postMessage(
                JSON.stringify({
                  type: 'SUCCESS',
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                })
              );
            }
          };

          var rzp = new Razorpay(options);

          rzp.on('payment.failed', function(response) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({
                type:   'FAILED',
                reason: response.error.description || 'Payment failed',
              })
            );
          });

          rzp.open();
        };
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'SUCCESS':
          onSuccess({
            razorpay_order_id:   data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature:  data.razorpay_signature,
          });
          break;
        case 'FAILED':
          onFailure(data.reason || 'Payment failed');
          break;
        case 'DISMISSED':
          onDismiss();
          break;
      }
    } catch (e) {
      console.warn('RazorpayWebView message parse error:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={rz.container}>
        <View style={rz.header}>
          <Text style={rz.title}>Secure Payment</Text>
          <TouchableOpacity onPress={onDismiss} style={rz.closeBtn}>
            <Text style={rz.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        <WebView
          ref={webRef}
          source={{ html }}
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => (
            <ActivityIndicator
              color="#22d3ee"
              style={StyleSheet.absoluteFill}
            />
          )}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
      </SafeAreaView>
    </Modal>
  );
}

const rz = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  title:    { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 4 },
  closeTxt: { color: '#64748b', fontSize: 22 },
});