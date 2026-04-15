import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getBookingWithMembers,
  updateMemberVerification,
  updateBookingPaymentStatus,
  updateBookingStatus,
} from '../../../src/services/adminService';
import { getSignedUrl } from '../../../src/services/storageService';
import { COLORS, SPACING, FONT, RADIUS } from '../../../src/constants/theme';

const VERIFICATION_COLORS = {
  pending: COLORS.warning,
  verified: COLORS.success,
  rejected: COLORS.error,
};

export default function AdminBookingDetail() {
  const { id } = useLocalSearchParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [signedUrls, setSignedUrls] = useState({});

  async function resolveSignedUrls(members) {
    const urls = {};
    await Promise.all(
      members.map(async (m) => {
        if (m.id_proof_url) {
          try {
            urls[`${m.id}_id`] = await getSignedUrl(m.id_proof_url);
          } catch { /* ignore */ }
        }
        if (m.face_photo_url) {
          try {
            urls[`${m.id}_face`] = await getSignedUrl(m.face_photo_url);
          } catch { /* ignore */ }
        }
      })
    );
    setSignedUrls(urls);
  }

  async function fetchBooking() {
    try {
      const data = await getBookingWithMembers(id);
      setBooking(data);
      await resolveSignedUrls(data.family_members || []);
    } catch {
      Alert.alert('Error', 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBooking();
  }, [id]);

  async function handleVerifyMember(memberId, status) {
    const action = status === 'verified' ? 'verify' : 'reject';
    Alert.alert(`Confirm ${action}`, `Are you sure you want to ${action} this member?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action.charAt(0).toUpperCase() + action.slice(1),
        style: status === 'rejected' ? 'destructive' : 'default',
        onPress: async () => {
          setUpdating(memberId);
          try {
            await updateMemberVerification(memberId, status, null);
            await fetchBooking();
          } catch {
            Alert.alert('Error', 'Failed to update verification');
          } finally {
            setUpdating(null);
          }
        },
      },
    ]);
  }

  async function handleUpdatePayment(paymentStatus) {
    setUpdating('payment');
    try {
      await updateBookingPaymentStatus(id, paymentStatus);
      await fetchBooking();
    } catch {
      Alert.alert('Error', 'Failed to update payment status');
    } finally {
      setUpdating(null);
    }
  }

  async function handleUpdateStatus(status) {
    setUpdating('status');
    try {
      await updateBookingStatus(id, status);
      await fetchBooking();
    } catch {
      Alert.alert('Error', 'Failed to update booking status');
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Booking not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Booking Info</Text>
        <InfoRow label="Name" value={booking.user_name} />
        <InfoRow label="Email" value={booking.email} />
        <InfoRow label="Phone" value={booking.phone} />
        <InfoRow label="Event" value={booking.events?.title} />
        <InfoRow label="Package" value={booking.packages?.name} />
        <InfoRow
          label="Total"
          value={`₹${Number(booking.total).toLocaleString('en-IN')}`}
          bold
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Booking Status</Text>
        <View style={styles.statusRow}>
          {['pending', 'confirmed', 'cancelled'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusButton,
                booking.status === s && styles.statusButtonActive,
              ]}
              onPress={() => handleUpdateStatus(s)}
              disabled={booking.status === s || updating === 'status'}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  booking.status === s && styles.statusButtonTextActive,
                ]}
              >
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payment Status</Text>
        <View style={styles.statusRow}>
          {['unpaid', 'paid', 'refunded'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusButton,
                booking.payment_status === s && styles.statusButtonActive,
              ]}
              onPress={() => handleUpdatePayment(s)}
              disabled={booking.payment_status === s || updating === 'payment'}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  booking.payment_status === s && styles.statusButtonTextActive,
                ]}
              >
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Family Members ({booking.family_members?.length || 0})
        </Text>

        {booking.family_members?.map((member) => {
          const vColor = VERIFICATION_COLORS[member.id_verification_status] || COLORS.textMuted;
          const idUrl = signedUrls[`${member.id}_id`];
          const faceUrl = signedUrls[`${member.id}_face`];

          return (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <View>
                  <Text style={styles.memberName}>{member.full_name}</Text>
                  <Text style={styles.memberMeta}>
                    {member.age} yrs • {member.gender} • {member.is_child ? 'Child' : 'Adult'}
                  </Text>
                </View>
                <View style={[styles.verBadge, { backgroundColor: vColor + '22' }]}>
                  <Text style={[styles.verBadgeText, { color: vColor }]}>
                    {(member.id_verification_status || 'pending').toUpperCase()}
                  </Text>
                </View>
              </View>

              {idUrl && (
                <View style={styles.idSection}>
                  <Text style={styles.idLabel}>ID Proof</Text>
                  <Image
                    source={{ uri: idUrl }}
                    style={styles.idImage}
                    resizeMode="contain"
                  />
                </View>
              )}

              {faceUrl && (
                <View style={styles.idSection}>
                  <Text style={styles.idLabel}>Face Photo</Text>
                  <Image
                    source={{ uri: faceUrl }}
                    style={styles.idImage}
                    resizeMode="contain"
                  />
                </View>
              )}

              {!idUrl && !faceUrl && (
                <View style={styles.noDocsBox}>
                  <Ionicons name="document-outline" size={18} color={COLORS.textMuted} />
                  <Text style={styles.noDocsText}>No documents uploaded yet</Text>
                </View>
              )}

              {member.id_verification_status === 'pending' && idUrl && (
                <View style={styles.verActions}>
                  <TouchableOpacity
                    style={[styles.verButton, styles.verifyBtn]}
                    onPress={() => handleVerifyMember(member.id, 'verified')}
                    disabled={updating === member.id}
                  >
                    {updating === member.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.verButtonText}>Verify</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.verButton, styles.rejectBtn]}
                    onPress={() => handleVerifyMember(member.id, 'rejected')}
                    disabled={updating === member.id}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                    <Text style={styles.verButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {booking.member_tickets?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Tickets ({booking.member_tickets.length})
          </Text>
          {booking.member_tickets.map((ticket) => (
            <View key={ticket.id} style={styles.ticketRow}>
              <Text style={styles.ticketQr}>{ticket.qr_code?.slice(0, 12)}...</Text>
              <Text
                style={[
                  styles.ticketStatus,
                  {
                    color:
                      ticket.status === 'active'
                        ? COLORS.success
                        : ticket.status === 'used'
                        ? COLORS.textMuted
                        : COLORS.error,
                  },
                ]}
              >
                {ticket.status.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value, bold }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, bold && infoStyles.bold]}>{value || '—'}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
  },
  value: {
    color: COLORS.text,
    fontSize: FONT.md,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  bold: {
    fontWeight: '800',
    color: COLORS.primary,
    fontSize: FONT.lg,
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statusRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statusButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  memberCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberName: {
    fontSize: FONT.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  memberMeta: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  verBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  verBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  idSection: {
    gap: SPACING.xs,
  },
  idLabel: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  idImage: {
    width: '100%',
    height: 150,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceLight,
  },
  noDocsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  noDocsText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
  },
  verActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  verButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  verifyBtn: {
    backgroundColor: COLORS.success,
  },
  rejectBtn: {
    backgroundColor: COLORS.error,
  },
  verButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT.md,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ticketQr: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
    fontFamily: 'monospace',
  },
  ticketStatus: {
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT.base,
  },
});
