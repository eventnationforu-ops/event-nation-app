import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getEventById, getPackagesByEventId } from '../../src/services/eventService';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ev, pkgs] = await Promise.all([
          getEventById(id),
          getPackagesByEventId(id),
        ]);
        setEvent(ev);
        setPackages(pkgs);
      } catch {
        // handled by empty state
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function formatTime(timeStr) {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {event.banner ? (
        <Image source={{ uri: event.banner }} style={styles.banner} />
      ) : (
        <View style={[styles.banner, styles.bannerPlaceholder]}>
          <Ionicons name="image-outline" size={64} color={COLORS.textMuted} />
        </View>
      )}

      <View style={styles.details}>
        <Text style={styles.title}>{event.title}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="calendar" size={18} color={COLORS.primary} />
          <Text style={styles.metaText}>{formatDate(event.event_date)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time" size={18} color={COLORS.primary} />
          <Text style={styles.metaText}>{formatTime(event.event_time)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location" size={18} color={COLORS.secondary} />
          <Text style={styles.metaText}>
            {event.venue}, {event.city}
          </Text>
        </View>

        {event.description && (
          <Text style={styles.description}>{event.description}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select a Package</Text>

        {packages.map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            style={[
              styles.packageCard,
              selectedPkg?.id === pkg.id && styles.packageSelected,
            ]}
            activeOpacity={0.8}
            onPress={() => setSelectedPkg(pkg)}
          >
            <View style={styles.packageHeader}>
              <Text style={styles.packageName}>{pkg.name}</Text>
              <Text style={styles.packagePrice}>₹{Number(pkg.base_price).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.packageMeta}>
              <Text style={styles.packageDetail}>
                Up to {pkg.max_adults} adults + {pkg.max_kids} kids
              </Text>
              <Text style={styles.packageDetail}>
                Extra adult: ₹{Number(pkg.extra_adult_price).toLocaleString('en-IN')}
              </Text>
            </View>
            {selectedPkg?.id === pkg.id && (
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.bookButton, !selectedPkg && styles.bookButtonDisabled]}
        disabled={!selectedPkg}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: '/checkout',
            params: {
              event_id: event.id,
              event_title: event.title,
              package_id: selectedPkg.id,
              package_json: JSON.stringify(selectedPkg),
            },
          })
        }
      >
        <Text style={styles.bookButtonText}>
          {selectedPkg ? `Continue with ${selectedPkg.name}` : 'Select a package'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: SPACING.xxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  banner: {
    width: '100%',
    height: 220,
  },
  bannerPlaceholder: {
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  title: {
    fontSize: FONT.xxl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaText: {
    fontSize: FONT.base,
    color: COLORS.textSecondary,
  },
  description: {
    fontSize: FONT.base,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginTop: SPACING.md,
  },
  section: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  packageCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    position: 'relative',
  },
  packageSelected: {
    borderColor: COLORS.primary,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  packageName: {
    fontSize: FONT.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  packagePrice: {
    fontSize: FONT.lg,
    fontWeight: '800',
    color: COLORS.primary,
  },
  packageMeta: {
    gap: SPACING.xs,
  },
  packageDetail: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
  },
  checkIcon: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    opacity: 0.4,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: FONT.lg,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT.base,
  },
});
