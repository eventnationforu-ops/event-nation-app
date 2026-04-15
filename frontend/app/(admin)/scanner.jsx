import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { checkinTicket } from '../../src/services/paymentService';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedResult, setScannedResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(true);
  const lastScannedRef = useRef('');

  async function handleBarCodeScanned({ data }) {
    if (!scanEnabled || processing) return;
    if (data === lastScannedRef.current) return;

    lastScannedRef.current = data;
    setScanEnabled(false);
    setProcessing(true);
    Vibration.vibrate(100);

    try {
      const result = await checkinTicket(data);
      setScannedResult({
        success: true,
        member: result.member,
        booking: result.booking,
        checked_in_at: result.checked_in_at,
      });
    } catch (err) {
      setScannedResult({
        success: false,
        error: err.message || 'Check-in failed',
      });
    } finally {
      setProcessing(false);
    }
  }

  function handleScanAgain() {
    lastScannedRef.current = '';
    setScannedResult(null);
    setScanEnabled(true);
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.permText}>Camera permission is required to scan QR codes</Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanEnabled ? handleBarCodeScanned : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.scanText}>
            {processing ? 'Verifying...' : 'Point at ticket QR code'}
          </Text>
        </View>
      </CameraView>

      {processing && (
        <View style={styles.processingBar}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.processingText}>Checking in...</Text>
        </View>
      )}

      {scannedResult && (
        <View style={[
          styles.resultCard,
          scannedResult.success ? styles.resultSuccess : styles.resultError,
        ]}>
          <Ionicons
            name={scannedResult.success ? 'checkmark-circle' : 'close-circle'}
            size={48}
            color={scannedResult.success ? COLORS.success : COLORS.error}
          />

          {scannedResult.success ? (
            <View style={styles.resultBody}>
              <Text style={styles.resultTitle}>Check-in Successful</Text>
              <Text style={styles.resultName}>
                {scannedResult.member?.full_name}
              </Text>
              <Text style={styles.resultMeta}>
                {scannedResult.member?.age} yrs • {scannedResult.member?.gender}
              </Text>
              <Text style={styles.resultEvent}>
                {scannedResult.booking?.event}
              </Text>
            </View>
          ) : (
            <View style={styles.resultBody}>
              <Text style={[styles.resultTitle, { color: COLORS.error }]}>
                Check-in Failed
              </Text>
              <Text style={styles.resultErrorText}>{scannedResult.error}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.scanAgainButton} onPress={handleScanAgain}>
            <Ionicons name="scan" size={20} color="#fff" />
            <Text style={styles.scanAgainText}>Scan Next</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  permText: {
    color: COLORS.textSecondary,
    fontSize: FONT.base,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  permButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
  },
  permButtonText: {
    color: '#fff',
    fontSize: FONT.lg,
    fontWeight: '700',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0, left: 0,
    borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
    borderColor: COLORS.primary,
  },
  topRight: {
    top: 0, right: 0,
    borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
    borderColor: COLORS.primary,
  },
  bottomLeft: {
    bottom: 0, left: 0,
    borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
    borderColor: COLORS.primary,
  },
  bottomRight: {
    bottom: 0, right: 0,
    borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
    borderColor: COLORS.primary,
  },
  scanText: {
    color: '#fff',
    fontSize: FONT.base,
    marginTop: SPACING.lg,
    fontWeight: '600',
  },
  processingBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface + 'EE',
    paddingVertical: SPACING.md,
  },
  processingText: {
    color: COLORS.text,
    fontSize: FONT.base,
    fontWeight: '600',
  },
  resultCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  resultSuccess: {
    backgroundColor: COLORS.card,
  },
  resultError: {
    backgroundColor: COLORS.card,
  },
  resultBody: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  resultTitle: {
    fontSize: FONT.xl,
    fontWeight: '800',
    color: COLORS.success,
  },
  resultName: {
    fontSize: FONT.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  resultMeta: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
  },
  resultEvent: {
    fontSize: FONT.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  resultErrorText: {
    color: COLORS.error,
    fontSize: FONT.base,
    textAlign: 'center',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: FONT.lg,
    fontWeight: '700',
  },
});
