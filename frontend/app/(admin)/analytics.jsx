import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllBookings } from '../../src/services/adminService';
import { getCheckinStatsByEvent } from '../../src/services/checkinService';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

export default function AnalyticsScreen() {
  const [bookings, setBookings] = useState([]);
  const [eventStats, setEventStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [allBookings, checkinStats] = await Promise.all([
        getAllBookings(),
        getCheckinStatsByEvent(),
      ]);
      setBookings(allBookings);
      setEventStats(checkinStats);
    } catch {
      // handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const cancelPending = bookings.filter((b) => b.status === 'cancel_pending').length;

    const totalRevenue = bookings
      .filter((b) => b.payment_status === 'paid')
      .reduce((sum, b) => sum + Number(b.total || 0), 0);

    const refundedAmount = bookings
      .filter((b) => ['refunded', 'partial_refund'].includes(b.payment_status))
      .reduce((sum, b) => sum + Number(b.total || 0), 0);

    const netRevenue = totalRevenue - refundedAmount;

    // Booking trend: group by date
    const trendMap = {};
    bookings.forEach((b) => {
      const date = new Date(b.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
      if (!trendMap[date]) trendMap[date] = { count: 0, revenue: 0 };
      trendMap[date].count++;
      if (b.payment_status === 'paid') {
        trendMap[date].revenue += Number(b.total || 0);
      }
    });

    const trend = Object.entries(trendMap)
      .map(([date, vals]) => ({ date, ...vals }))
      .slice(-14); // last 14 days

    // Revenue by event
    const eventRevenueMap = {};
    bookings
      .filter((b) => b.payment_status === 'paid')
      .forEach((b) => {
        const title = b.events?.title || 'Unknown';
        if (!eventRevenueMap[title]) eventRevenueMap[title] = 0;
        eventRevenueMap[title] += Number(b.total || 0);
      });

    const revenueByEvent = Object.entries(eventRevenueMap)
      .map(([title, amount]) => ({ title, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      total, confirmed, cancelled, pending, cancelPending,
      totalRevenue, refundedAmount, netRevenue,
      trend, revenueByEvent,
    };
  }, [bookings]);

  const checkinOverall = useMemo(() => {
    const total = eventStats.reduce((s, e) => s + e.total, 0);
    const checkedIn = eventStats.reduce((s, e) => s + e.checked_in, 0);
    return { total, checkedIn, pct: total > 0 ? Math.round((checkedIn / total) * 100) : 0 };
  }, [eventStats]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const maxTrendCount = Math.max(...stats.trend.map((t) => t.count), 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Revenue cards */}
      <View style={styles.revenueRow}>
        <RevenueCard
          label="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`}
          icon="cash"
          color={COLORS.success}
        />
        <RevenueCard
          label="Net Revenue"
          value={`₹${stats.netRevenue.toLocaleString('en-IN')}`}
          icon="trending-up"
          color={COLORS.primary}
        />
      </View>
      <View style={styles.revenueRow}>
        <RevenueCard
          label="Refunded"
          value={`₹${stats.refundedAmount.toLocaleString('en-IN')}`}
          icon="arrow-undo"
          color={COLORS.error}
        />
        <RevenueCard
          label="Check-in Rate"
          value={`${checkinOverall.pct}%`}
          icon="scan"
          color={COLORS.warning}
          subtitle={`${checkinOverall.checkedIn}/${checkinOverall.total}`}
        />
      </View>

      {/* Booking stats */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Booking Overview</Text>
        <View style={styles.statsGrid}>
          <StatPill label="Total" value={stats.total} color={COLORS.primary} />
          <StatPill label="Confirmed" value={stats.confirmed} color={COLORS.success} />
          <StatPill label="Pending" value={stats.pending} color={COLORS.warning} />
          <StatPill label="Cancelled" value={stats.cancelled} color={COLORS.error} />
          <StatPill label="Cancel Req" value={stats.cancelPending} color={COLORS.textMuted} />
        </View>
      </View>

      {/* Booking Trend (bar chart) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Booking Trend (Last 14 Days)</Text>
        {stats.trend.length === 0 ? (
          <Text style={styles.emptyText}>No booking data</Text>
        ) : (
          <View style={styles.chartContainer}>
            {stats.trend.map((item, idx) => (
              <View key={idx} style={styles.barColumn}>
                <Text style={styles.barValue}>{item.count}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${(item.count / maxTrendCount) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{item.date}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Revenue by event */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Revenue by Event</Text>
        {stats.revenueByEvent.length === 0 ? (
          <Text style={styles.emptyText}>No revenue data</Text>
        ) : (
          stats.revenueByEvent.map((item, idx) => {
            const maxAmount = stats.revenueByEvent[0]?.amount || 1;
            const pct = Math.round((item.amount / maxAmount) * 100);
            return (
              <View key={idx} style={styles.revenueEventRow}>
                <View style={styles.revenueEventInfo}>
                  <Text style={styles.revenueEventTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.revenueEventAmount}>
                    ₹{item.amount.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Check-in stats per event */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Check-in by Event</Text>
        {eventStats.length === 0 ? (
          <Text style={styles.emptyText}>No check-in data</Text>
        ) : (
          eventStats.map((event) => {
            const pct = event.total > 0 ? Math.round((event.checked_in / event.total) * 100) : 0;
            return (
              <View key={event.event_id} style={styles.checkinRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkinTitle}>{event.title}</Text>
                  <Text style={styles.checkinMeta}>
                    {event.checked_in}/{event.total} checked in
                  </Text>
                </View>
                <View style={styles.pctCircle}>
                  <Text style={styles.pctText}>{pct}%</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function RevenueCard({ label, value, icon, color, subtitle }) {
  return (
    <View style={[rcStyles.card, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[rcStyles.value, { color }]}>{value}</Text>
      <Text style={rcStyles.label}>{label}</Text>
      {subtitle && <Text style={rcStyles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

function StatPill({ label, value, color }) {
  return (
    <View style={[spStyles.pill, { borderColor: color + '40' }]}>
      <Text style={[spStyles.value, { color }]}>{value}</Text>
      <Text style={spStyles.label}>{label}</Text>
    </View>
  );
}

const rcStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    gap: SPACING.xs,
  },
  value: {
    fontSize: FONT.xl,
    fontWeight: '800',
  },
  label: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
  },
});

const spStyles = StyleSheet.create({
  pill: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  value: {
    fontSize: FONT.lg,
    fontWeight: '800',
  },
  label: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  revenueRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
    gap: 2,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  barValue: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  barTrack: {
    width: '80%',
    height: 100,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 3,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 8,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  revenueEventRow: {
    gap: SPACING.xs,
  },
  revenueEventInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revenueEventTitle: {
    flex: 1,
    fontSize: FONT.md,
    color: COLORS.text,
    fontWeight: '600',
    marginRight: SPACING.sm,
  },
  revenueEventAmount: {
    fontSize: FONT.md,
    color: COLORS.success,
    fontWeight: '800',
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checkinTitle: {
    fontSize: FONT.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  checkinMeta: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pctCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.success + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pctText: {
    fontSize: FONT.md,
    fontWeight: '800',
    color: COLORS.success,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT.md,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});
