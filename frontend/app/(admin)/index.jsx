import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { getAllBookings } from '../../src/services/adminService';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

const STATUS_COLORS = {
  pending: COLORS.warning,
  confirmed: COLORS.success,
  cancelled: COLORS.error,
  cancel_pending: COLORS.textMuted,
};

const PAYMENT_COLORS = {
  unpaid: COLORS.warning,
  paid: COLORS.success,
  refunded: COLORS.textMuted,
  partial_refund: COLORS.secondary,
};

export default function AdminDashboard() {
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterEvent, setFilterEvent] = useState('all');
  const [exporting, setExporting] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const data = await getAllBookings();
      setBookings(data);
    } catch {
      // handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const paid = bookings.filter((b) => b.payment_status === 'paid').length;
    const revenue = bookings
      .filter((b) => b.payment_status === 'paid')
      .reduce((sum, b) => sum + Number(b.total || 0), 0);
    return { total, pending, confirmed, paid, revenue };
  }, [bookings]);

  const eventNames = useMemo(() => {
    const names = new Set();
    bookings.forEach((b) => {
      if (b.events?.title) names.add(b.events.title);
    });
    return ['all', ...Array.from(names)];
  }, [bookings]);

  const filtered = bookings.filter((b) => {
    const matchesSearch =
      !search ||
      b.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.email?.toLowerCase().includes(search.toLowerCase()) ||
      b.id?.includes(search);
    const matchesFilter = filterStatus === 'all' || b.status === filterStatus;
    const matchesPayment = filterPayment === 'all' || b.payment_status === filterPayment;
    const matchesEvent = filterEvent === 'all' || b.events?.title === filterEvent;
    return matchesSearch && matchesFilter && matchesPayment && matchesEvent;
  });

  const statusFilters = ['all', 'pending', 'confirmed', 'cancelled', 'cancel_pending'];
  const paymentFilters = ['all', 'unpaid', 'paid', 'refunded'];

  async function handleExportCSV() {
    if (filtered.length === 0) {
      Alert.alert('No Data', 'No bookings to export');
      return;
    }
    setExporting(true);
    try {
      const headers = ['Booking ID', 'Name', 'Email', 'Phone', 'Event', 'Package', 'Status', 'Payment', 'Total', 'Date'];
      const rows = filtered.map((b) => [
        b.id,
        `"${(b.user_name || '').replace(/"/g, '""')}"`,
        b.email || '',
        b.phone || '',
        `"${(b.events?.title || '').replace(/"/g, '""')}"`,
        `"${(b.packages?.name || '').replace(/"/g, '""')}"`,
        b.status,
        b.payment_status,
        b.total,
        new Date(b.created_at).toLocaleDateString('en-IN'),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const filePath = `${FileSystem.cacheDirectory}bookings-export.csv`;
      await FileSystem.writeAsStringAsync(filePath, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Bookings',
        });
      } else {
        Alert.alert('Exported', `File saved to ${filePath}`);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  }

  function renderBooking({ item }) {
    const statusColor = STATUS_COLORS[item.status] || COLORS.textMuted;
    const paymentColor = PAYMENT_COLORS[item.payment_status] || COLORS.textMuted;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/(admin)/booking/${item.id}`)}
      >
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bookingName}>{item.user_name}</Text>
            <Text style={styles.bookingEmail}>{item.email}</Text>
          </View>
          <Text style={styles.bookingTotal}>
            ₹{Number(item.total).toLocaleString('en-IN')}
          </Text>
        </View>

        <View style={styles.cardRow}>
          <Text style={styles.eventName} numberOfLines={1}>
            {item.events?.title || '—'}
          </Text>
          <Text style={styles.packageLabel}>{item.packages?.name || '—'}</Text>
        </View>

        <View style={styles.cardRow}>
          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: paymentColor + '22' }]}>
            <Text style={[styles.badgeText, { color: paymentColor }]}>
              {item.payment_status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
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
      <View style={styles.statsRow}>
        <StatCard label="Total" value={stats.total} color={COLORS.primary} />
        <StatCard label="Pending" value={stats.pending} color={COLORS.warning} />
        <StatCard label="Confirmed" value={stats.confirmed} color={COLORS.success} />
        <StatCard
          label="Revenue"
          value={`₹${stats.revenue.toLocaleString('en-IN')}`}
          color={COLORS.secondary}
          small
        />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(admin)/scanner')}
        >
          <Ionicons name="scan" size={18} color="#fff" />
          <Text style={styles.actionText}>Scan QR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(admin)/checkin-dashboard')}
        >
          <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
          <Text style={[styles.actionText, { color: COLORS.primary }]}>Check-ins</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: COLORS.warning }]}
          onPress={() => router.push('/(admin)/refunds')}
        >
          <Ionicons name="receipt" size={18} color="#fff" />
          <Text style={styles.actionText}>Refunds</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: COLORS.success }]}
          onPress={() => router.push('/(admin)/analytics')}
        >
          <Ionicons name="analytics" size={18} color="#fff" />
          <Text style={styles.actionText}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={handleExportCSV}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.actionText, { color: COLORS.primary }]}>CSV</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email, or ID"
          placeholderTextColor={COLORS.textMuted}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.filterLabel}>Booking Status</Text>
      <FlatList
        horizontal
        data={statusFilters}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              filterStatus === item && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus(item)}
          >
            <Text
              style={[
                styles.filterText,
                filterStatus === item && styles.filterTextActive,
              ]}
            >
              {item === 'all' ? 'All' : item.replace('_', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.filterLabel}>Payment Status</Text>
      <FlatList
        horizontal
        data={paymentFilters}
        keyExtractor={(item) => `pay_${item}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              filterPayment === item && styles.filterChipActive,
            ]}
            onPress={() => setFilterPayment(item)}
          >
            <Text
              style={[
                styles.filterText,
                filterPayment === item && styles.filterTextActive,
              ]}
            >
              {item === 'all' ? 'All' : item.replace('_', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}
      />

      {eventNames.length > 1 && (
        <>
          <Text style={styles.filterLabel}>Event</Text>
          <FlatList
            horizontal
            data={eventNames}
            keyExtractor={(item) => `ev_${item}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filterEvent === item && styles.filterChipActive,
                ]}
                onPress={() => setFilterEvent(item)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filterEvent === item && styles.filterTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {item === 'all' ? 'All Events' : item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      <Text style={styles.countText}>{filtered.length} bookings</Text>

      <FlatList
        data={filtered}
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
            <Ionicons name="folder-open-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No bookings found</Text>
          </View>
        }
      />
    </View>
  );
}

function StatCard({ label, value, color, small }) {
  return (
    <View style={[statStyles.card, { borderLeftColor: color }]}>
      <Text style={[statStyles.value, small && statStyles.valueSmall, { color }]}>
        {value}
      </Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  value: {
    fontSize: FONT.xl,
    fontWeight: '800',
  },
  valueSmall: {
    fontSize: FONT.md,
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  actionButtonSecondary: {
    backgroundColor: COLORS.primary + '18',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT.base,
    color: COLORS.text,
  },
  filterLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  filterRow: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    marginBottom: SPACING.sm,
  },
  list: {
    padding: SPACING.md,
    paddingTop: 0,
    gap: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingName: {
    fontSize: FONT.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  bookingEmail: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
  },
  bookingTotal: {
    fontSize: FONT.base,
    fontWeight: '800',
    color: COLORS.primary,
  },
  eventName: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
    flex: 1,
  },
  packageLabel: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT.base,
    marginTop: SPACING.md,
  },
});
