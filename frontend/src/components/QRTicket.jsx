import { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT, RADIUS } from '../constants/theme';

export default function QRTicket({ ticket, memberName, eventTitle, size = 160 }) {
  const qrRef = useRef(null);
  const isActive = ticket.status === 'active' && ticket.qr_status !== 'used';
  const isUsed = ticket.qr_status === 'used';
  const statusLabel = isUsed ? 'CHECKED IN' : isActive ? 'ACTIVE' : ticket.status.toUpperCase();
  const statusColor = isUsed
    ? COLORS.textMuted
    : isActive
    ? COLORS.success
    : COLORS.warning;

  const handleShare = useCallback(async () => {
    try {
      if (!qrRef.current) return;

      qrRef.current.toDataURL(async (dataURL) => {
        try {
          const fileName = `ticket-${ticket.qr_code?.slice(0, 8)}.png`;
          const filePath = `${FileSystem.cacheDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(filePath, dataURL, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(filePath, {
              mimeType: 'image/png',
              dialogTitle: `Ticket for ${memberName || 'Event'}`,
            });
          } else {
            Alert.alert('Saved', `Ticket saved to ${filePath}`);
          }
        } catch {
          Alert.alert('Error', 'Could not share the ticket');
        }
      });
    } catch {
      Alert.alert('Error', 'Could not generate ticket image');
    }
  }, [ticket, memberName]);

  return (
    <View style={styles.container}>
      <View style={[styles.qrWrapper, !isActive && styles.qrInactive]}>
        <QRCode
          value={ticket.qr_code}
          size={size}
          backgroundColor={COLORS.text}
          color={COLORS.background}
          getRef={(ref) => { qrRef.current = ref; }}
        />
        {isUsed && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>USED</Text>
          </View>
        )}
      </View>
      {memberName && (
        <Text style={styles.memberName}>{memberName}</Text>
      )}
      {eventTitle && (
        <Text style={styles.eventTitle}>{eventTitle}</Text>
      )}
      <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>
      <Text style={styles.ticketId}>
        {ticket.qr_code?.slice(0, 8)}
      </Text>
      {isActive && (
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={16} color={COLORS.primary} />
          <Text style={styles.shareText}>Share / Download</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qrWrapper: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.text,
    position: 'relative',
  },
  qrInactive: {
    opacity: 0.4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: FONT.xl,
    fontWeight: '900',
    letterSpacing: 2,
  },
  memberName: {
    fontSize: FONT.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  ticketId: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
  },
  eventTitle: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '10',
  },
  shareText: {
    fontSize: FONT.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
