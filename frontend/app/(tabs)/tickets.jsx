import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMyBookings } from '../../src/services/bookingService';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

const STATUS_COLORS = {
  pending: COLORS.warning,
  confirmed: COLORS.success,
  cancelled: COLORS.error,
  cancel_pending: COLORS.textMuted,
};

export default function TicketsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const data = await getMyBookings();
      setBookings(data);
    } catch {
      // silently fail, show empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function renderBooking({ item }) {
    const statusColor = STATUS_COLORS[item.status] || COLORS.textMuted;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/booking/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {item.events?.title || 'Event'}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="pricetag-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>{item.packages?.name || 'Package'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>
            {item.events?.event_date ? formatDate(item.events.event_date) : '—'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>
            {item.events?.venue}, {item.events?.city}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.total}>₹{Number(item.total).toLocaleString('en-IN')}</Text>
          <Text style={[styles.paymentBadge, {
            color: item.payment_status === 'paid' ? COLORS.success : COLORS.warning,
          }]}>
            {item.payment_status.toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBooking}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchBookings();
            }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="ticket-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No bookings yet</Text>
            <Text style={styles.emptySubtext}>Book an event to get started</Text>
          </View>
        }
      />
    </View>
  );
}

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
    padding: SPACING.xxl,
  },
  list: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: FONT.lg,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoText: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  total: {
    fontSize: FONT.lg,
    fontWeight: '800',
    color: COLORS.text,
  },
  paymentBadge: {
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT.base,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: FONT.md,
    marginTop: SPACING.xs,
  },
});
