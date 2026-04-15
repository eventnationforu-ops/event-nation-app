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
import {
  getCheckinStatsByEvent,
  getRecentCheckins,
} from '../../src/services/checkinService';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

export default function CheckinDashboard() {
  const router = useRouter();
  const [eventStats, setEventStats] = useState([]);
  const [recentCheckins, setRecentCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [stats, recent] = await Promise.all([
        getCheckinStatsByEvent(),
        getRecentCheckins(null, 15),
      ]);
      setEventStats(stats);
      setRecentCheckins(recent);
    } catch {
      // handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }

  function formatTime(timeStr) {
    return new Date(timeStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const totalExpected = eventStats.reduce((s, e) => s + e.total, 0);
  const totalCheckedIn = eventStats.reduce((s, e) => s + e.checked_in, 0);
  const totalRemaining = eventStats.reduce((s, e) => s + e.active, 0);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={[]}
      renderItem={null}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }}
          tintColor={COLORS.primary}
        />
      }
      ListHeaderComponent={
        <>
          {/* Global Stats */}
          <View style={styles.globalStats}>
            <StatCard label="Expected" value={totalExpected} color={COLORS.primary} />
            <StatCard label="Checked In" value={totalCheckedIn} color={COLORS.success} />
            <StatCard label="Remaining" value={totalRemaining} color={COLORS.warning} />
          </View>

          {/* Scan Button */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push('/(admin)/scanner')}
          >
            <Ionicons name="scan" size={24} color="#fff" />
            <Text style={styles.scanButtonText}>Open Scanner</Text>
          </TouchableOpacity>

          {/* Per-Event Stats */}
          <Text style={styles.sectionLabel}>CHECK-IN BY EVENT</Text>
          {eventStats.map((event) => {
            const pct = event.total > 0
              ? Math.round((event.checked_in / event.total) * 100)
              : 0;
            return (
              <View key={event.event_id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventMeta}>
                      {formatDate(event.event_date)} • {event.venue}, {event.city}
                    </Text>
                  </View>
                  <Text style={styles.eventPct}>{pct}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <View style={styles.eventStatsRow}>
                  <Text style={styles.eventStat}>
                    <Text style={{ color: COLORS.success, fontWeight: '800' }}>
                      {event.checked_in}
                    </Text>{' '}
                    checked in
                  </Text>
                  <Text style={styles.eventStat}>
                    <Text style={{ color: COLORS.warning, fontWeight: '800' }}>
                      {event.active}
                    </Text>{' '}
                    remaining
                  </Text>
                  <Text style={styles.eventStat}>
                    <Text style={{ fontWeight: '800', color: COLORS.text }}>
                      {event.total}
                    </Text>{' '}
                    total
                  </Text>
                </View>
              </View>
            );
          })}

          {eventStats.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="scan-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No ticket data yet</Text>
            </View>
          )}

          {/* Recent Check-ins */}
          {recentCheckins.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>RECENT CHECK-INS</Text>
              {recentCheckins.map((item) => (
                <View key={item.id} style={styles.recentRow}>
                  <View style={styles.recentDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentName}>
                      {item.family_members?.full_name || 'Unknown'}
                    </Text>
                    <Text style={styles.recentMeta}>
                      Booked by {item.bookings?.user_name} •{' '}
                      {item.checked_in_at ? formatTime(item.checked_in_at) : ''}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                </View>
              ))}
            </>
          )}

          <View style={styles.autoRefresh}>
            <Ionicons name="refresh" size={12} color={COLORS.textMuted} />
            <Text style={styles.autoRefreshText}>Auto-refreshes every 5 seconds</Text>
          </View>
        </>
      }
    />
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={[statStyles.card, { borderTopColor: color }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  value: {
    fontSize: FONT.xxl,
    fontWeight: '800',
  },
  label: {
    fontSize: FONT.sm,
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
  globalStats: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: FONT.lg,
    fontWeight: '700',
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.sm,
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventTitle: {
    fontSize: FONT.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  eventMeta: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  eventPct: {
    fontSize: FONT.xl,
    fontWeight: '800',
    color: COLORS.success,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 3,
  },
  eventStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventStat: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
  },
  empty: {
    alignItems: 'center',
    padding: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT.base,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  recentName: {
    fontSize: FONT.base,
    fontWeight: '600',
    color: COLORS.text,
  },
  recentMeta: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  autoRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
  },
  autoRefreshText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
  },
});
