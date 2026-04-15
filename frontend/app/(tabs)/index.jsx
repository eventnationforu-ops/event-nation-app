import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getEvents } from '../../src/services/eventService';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchEvents = useCallback(async () => {
    try {
      setError('');
      const data = await getEvents();
      setEvents(data);
    } catch (err) {
      setError('Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function onRefresh() {
    setRefreshing(true);
    fetchEvents();
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function renderEvent({ item }) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/event/${item.id}`)}
      >
        {item.banner ? (
          <Image source={{ uri: item.banner }} style={styles.banner} />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]}>
            <Ionicons name="image-outline" size={48} color={COLORS.textMuted} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
            <Text style={styles.metaText}>{formatDate(item.event_date)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.secondary} />
            <Text style={styles.metaText}>
              {item.venue}, {item.city}
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
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="calendar-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No upcoming events</Text>
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  banner: {
    width: '100%',
    height: 180,
  },
  bannerPlaceholder: {
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  eventTitle: {
    fontSize: FONT.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaText: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 83, 80, 0.15)',
    padding: SPACING.md,
    margin: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT.base,
    marginTop: SPACING.md,
  },
});
