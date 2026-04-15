import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

export default function ProfileScreen() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.name}>{profile?.full_name || 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {isAdmin && (
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />
            <Text style={styles.adminText}>Admin</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        {isAdmin && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(admin)')}
          >
            <View style={[styles.menuIcon, { backgroundColor: COLORS.primary + '22' }]}>
              <Ionicons name="settings" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuLabel}>Admin Panel</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/tickets')}>
          <View style={[styles.menuIcon, { backgroundColor: COLORS.success + '22' }]}>
            <Ionicons name="ticket" size={20} color={COLORS.success} />
          </View>
          <Text style={styles.menuLabel}>My Bookings</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
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
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  name: {
    fontSize: FONT.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  email: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary + '22',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  adminText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: FONT.sm,
  },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: FONT.base,
    color: COLORS.text,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.error + '15',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.error + '40',
  },
  logoutText: {
    color: COLORS.error,
    fontSize: FONT.base,
    fontWeight: '600',
  },
});
