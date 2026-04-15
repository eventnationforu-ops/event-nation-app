import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getBookingById } from '../src/services/bookingService';
import { COLORS, SPACING, FONT, RADIUS } from '../src/constants/theme';

export default function SuccessScreen() {
  const { booking_id, total, event_title, payment_verified } = useLocalSearchParams();
  const router = useRouter();
  const isPaid = payment_verified === 'true';

  const [ticketCount, setTicketCount] = useState(null);

  useEffect(() => {
    if (isPaid && booking_id) {
      getBookingById(booking_id)
        .then((booking) => {
          const active = booking.member_tickets?.filter((t) => t.status === 'active') || [];
          setTicketCount(active.length);
        })
        .catch(() => {});
    }
  }, [isPaid, booking_id]);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons
          name={isPaid ? 'checkmark-circle' : 'time'}
          size={80}
          color={isPaid ? COLORS.success : COLORS.warning}
        />
      </View>

      <Text style={styles.title}>
        {isPaid ? 'Payment Successful!' : 'Booking Created'}
      </Text>
      <Text style={styles.subtitle}>{event_title}</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Booking ID</Text>
          <Text style={styles.value} numberOfLines={1}>
            {booking_id?.slice(0, 8)}...
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Total Amount</Text>
          <Text style={styles.totalValue}>₹{Number(total).toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Payment</Text>
          <View style={[styles.badge, {
            backgroundColor: isPaid ? COLORS.success + '22' : COLORS.warning + '22',
          }]}>
            <Text style={[styles.badgeText, {
              color: isPaid ? COLORS.success : COLORS.warning,
            }]}>
              {isPaid ? 'PAID' : 'PENDING'}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Tickets</Text>
          {ticketCount !== null ? (
            <View style={[styles.badge, { backgroundColor: COLORS.success + '22' }]}>
              <Text style={[styles.badgeText, { color: COLORS.success }]}>
                {ticketCount} ACTIVE
              </Text>
            </View>
          ) : (
            <View style={[styles.badge, {
              backgroundColor: isPaid ? COLORS.success + '22' : COLORS.textMuted + '22',
            }]}>
              <Text style={[styles.badgeText, {
                color: isPaid ? COLORS.success : COLORS.textMuted,
              }]}>
                {isPaid ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.note}>
        {isPaid
          ? 'Your tickets with QR codes are ready! Show them at the venue for check-in. Upload ID proofs for each family member before the event.'
          : 'Your booking is pending payment. Complete payment to activate your tickets.'}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace(`/booking/${booking_id}`)}
        >
          <Ionicons
            name={isPaid ? 'qr-code' : 'document-attach'}
            size={20}
            color="#fff"
          />
          <Text style={styles.primaryButtonText}>
            {isPaid ? 'View Tickets & QR Codes' : 'View Booking Details'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace('/(tabs)/tickets')}
        >
          <Text style={styles.secondaryButtonText}>All My Bookings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.secondaryButtonText}>Browse Events</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  iconCircle: {
    alignSelf: 'center',
  },
  title: {
    fontSize: FONT.xxl,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
  },
  value: {
    color: COLORS.text,
    fontSize: FONT.md,
    fontWeight: '600',
    maxWidth: '50%',
  },
  totalValue: {
    color: COLORS.primary,
    fontSize: FONT.lg,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  note: {
    color: COLORS.textMuted,
    fontSize: FONT.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    gap: SPACING.md,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FONT.lg,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT.base,
    fontWeight: '600',
  },
});
