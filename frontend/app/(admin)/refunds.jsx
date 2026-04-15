import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPendingRefunds } from '../../src/services/adminService';
import { processRefund, sendEmail } from '../../src/services/paymentService';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

export default function RefundsScreen() {
  const [refunds, setRefunds] = useState([]);
  const [allRefunds, setAllRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [filter, setFilter] = useState('pending');

  const fetchRefunds = useCallback(async () => {
    try {
      const data = await getPendingRefunds();
      setAllRefunds(data);
    } catch {
      // handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  useEffect(() => {
    if (filter === 'all') {
      setRefunds(allRefunds);
    } else {
      setRefunds(allRefunds.filter((r) => r.status === filter));
    }
  }, [filter, allRefunds]);

  async function handleAction(refundId, bookingId, action) {
    const actionLabel = action === 'approve' ? 'approve' : 'reject';

    Alert.alert(
      `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} Refund`,
      `Are you sure you want to ${actionLabel} this refund request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1),
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            setProcessing(refundId);
            try {
              await processRefund({ refundId, action });

              try {
                const emailType = action === 'approve'
                  ? 'cancellation_confirmation'
                  : 'refund_status';
                await sendEmail({ type: emailType, bookingId });
              } catch {
                // Email is non-critical
              }

              Alert.alert(
                'Success',
                `Refund ${action === 'approve' ? 'approved and processed' : 'rejected'} successfully.`
              );
              await fetchRefunds();
            } catch (err) {
              Alert.alert('Error', err.message || `Failed to ${actionLabel} refund`);
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function renderRefund({ item }) {
    const booking = item.bookings;
    const isProcessing = processing === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{booking?.user_name || '—'}</Text>
            <Text style={styles.userEmail}>{booking?.email || '—'}</Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: item.status === 'pending' ? COLORS.warning + '22'
              : item.status === 'approved' ? COLORS.success + '22'
              : COLORS.error + '22'
          }]}>
            <Text style={[styles.statusText, {
              color: item.status === 'pending' ? COLORS.warning
                : item.status === 'approved' ? COLORS.success
                : COLORS.error
            }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.eventRow}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.eventText}>
            {booking?.events?.title || 'Event'} — {booking?.events?.event_date ? formatDate(booking.events.event_date) : '—'}
          </Text>
        </View>

        <View style={styles.refundDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Booking Total</Text>
            <Text style={styles.detailValue}>
              ₹{Number(booking?.total || 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Refund Rate</Text>
            <Text style={styles.detailValue}>{item.refund_percentage}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Processing Fee</Text>
            <Text style={styles.detailValue}>
              ₹{Number(item.processing_fee).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.refundLabel}>Refund Amount</Text>
            <Text style={styles.refundValue}>
              ₹{Number(item.refund_amount).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        <Text style={styles.dateText}>
          Requested: {formatDate(item.created_at)}
        </Text>

        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleAction(item.id, item.booking_id, 'approve')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Approve & Refund</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleAction(item.id, item.booking_id, 'reject')}
              disabled={isProcessing}
            >
              <Ionicons name="close" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
      <View style={styles.filterRow}>
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.countText}>{refunds.length} refund requests</Text>

      <FlatList
        data={refunds}
        keyExtractor={(item) => item.id}
        renderItem={renderRefund}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRefunds(); }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No refund requests</Text>
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  filterChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontSize: FONT.sm,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  countText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
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
    alignItems: 'flex-start',
  },
  userName: {
    fontSize: FONT.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  eventText: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
  },
  refundDetails: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
  },
  detailValue: {
    color: COLORS.text,
    fontSize: FONT.md,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  refundLabel: {
    color: COLORS.text,
    fontSize: FONT.base,
    fontWeight: '700',
  },
  refundValue: {
    color: COLORS.success,
    fontSize: FONT.base,
    fontWeight: '800',
  },
  dateText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  approveBtn: {
    backgroundColor: COLORS.success,
  },
  rejectBtn: {
    backgroundColor: COLORS.error,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT.md,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT.base,
    marginTop: SPACING.md,
  },
});
