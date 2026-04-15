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
import * as ImagePicker from 'expo-image-picker';
import { getBookingById, cancelBooking, createRefundRequest } from '../../src/services/bookingService';
import { uploadIdProof, uploadFacePhoto, getSignedUrl } from '../../src/services/storageService';
import { calculateRefund } from '../../src/utils/refund';
import QRTicket from '../../src/components/QRTicket';
import { COLORS, SPACING, FONT, RADIUS } from '../../src/constants/theme';

const STATUS_COLORS = {
  pending: COLORS.warning,
  confirmed: COLORS.success,
  cancelled: COLORS.error,
  cancel_pending: COLORS.textMuted,
};

const VERIFICATION_COLORS = {
  pending: COLORS.warning,
  verified: COLORS.success,
  rejected: COLORS.error,
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [signedUrls, setSignedUrls] = useState({});
  const [showRefund, setShowRefund] = useState(false);

  async function fetchBooking() {
    try {
      const data = await getBookingById(id);
      setBooking(data);
      await resolveSignedUrls(data.family_members || []);
    } catch {
      Alert.alert('Error', 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }

  async function resolveSignedUrls(members) {
    const urls = {};
    await Promise.all(
      members.map(async (m) => {
        if (m.id_proof_url) {
          try { urls[`${m.id}_id`] = await getSignedUrl(m.id_proof_url); } catch { /* */ }
        }
        if (m.face_photo_url) {
          try { urls[`${m.id}_face`] = await getSignedUrl(m.face_photo_url); } catch { /* */ }
        }
      })
    );
    setSignedUrls(urls);
  }

  useEffect(() => { fetchBooking(); }, [id]);

  async function pickAndUpload(memberId, type) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const fileName = asset.uri.split('/').pop() || 'photo.jpg';

    setUploading(`${memberId}_${type}`);
    try {
      const uploader = type === 'id' ? uploadIdProof : uploadFacePhoto;
      const signedUrl = await uploader(memberId, asset.uri, fileName);
      setSignedUrls((prev) => ({ ...prev, [`${memberId}_${type}`]: signedUrl }));
      await fetchBooking();
    } catch (err) {
      Alert.alert('Upload Failed', err.message || 'Could not upload image');
    } finally {
      setUploading(null);
    }
  }

  function handleCancelWithRefund() {
    if (!booking?.events?.event_date) {
      Alert.alert('Error', 'Could not determine event date');
      return;
    }

    const refund = calculateRefund(booking.total, booking.events.event_date);

    if (refund.refund_percentage === 0) {
      Alert.alert(
        'No Refund Available',
        'The event is less than 7 days away. No refund is available for cancellations at this time.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Cancel Booking',
      `Refund breakdown:\n\n` +
      `Days until event: ${refund.days_before_event}\n` +
      `Refund rate: ${refund.refund_percentage}%\n` +
      `Processing fee (5%): ₹${refund.processing_fee.toLocaleString('en-IN')}\n` +
      `You'll receive: ₹${refund.refund_amount.toLocaleString('en-IN')}\n\n` +
      `Proceed with cancellation?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await createRefundRequest(id, refund);
              await fetchBooking();
              Alert.alert('Request Submitted', 'Your cancellation request has been submitted for admin approval.');
            } catch {
              Alert.alert('Error', 'Failed to submit cancellation request');
            }
          },
        },
      ]
    );
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

  const statusColor = STATUS_COLORS[booking.status] || COLORS.textMuted;
  const activeTickets = booking.member_tickets?.filter(
    (t) => t.status === 'active'
  ) || [];
  const memberMap = {};
  booking.family_members?.forEach((m) => { memberMap[m.id] = m; });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {booking.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        <InfoRow label="Event" value={booking.events?.title} />
        <InfoRow label="Package" value={booking.packages?.name} />
        <InfoRow label="Phone" value={booking.phone} />
        <InfoRow
          label="Total"
          value={`₹${Number(booking.total).toLocaleString('en-IN')}`}
          bold
        />
        <InfoRow
          label="Payment"
          value={booking.payment_status.replace('_', ' ').toUpperCase()}
          color={booking.payment_status === 'paid' ? COLORS.success : COLORS.warning}
        />
      </View>

      {/* QR Tickets Section */}
      {activeTickets.length > 0 && (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Your Tickets</Text>
            <View style={styles.ticketCount}>
              <Ionicons name="qr-code" size={14} color={COLORS.primary} />
              <Text style={styles.ticketCountText}>{activeTickets.length}</Text>
            </View>
          </View>
          {activeTickets.map((ticket) => {
            const member = memberMap[ticket.member_id];
            return (
              <QRTicket
                key={ticket.id}
                ticket={ticket}
                memberName={member?.full_name}
                eventTitle={booking.events?.title}
              />
            );
          })}
        </View>
      )}

      {/* Inactive tickets notice */}
      {booking.payment_status !== 'paid' && booking.member_tickets?.length > 0 && (
        <View style={styles.inactiveNotice}>
          <Ionicons name="information-circle" size={20} color={COLORS.warning} />
          <Text style={styles.inactiveText}>
            Tickets will be activated after payment is confirmed
          </Text>
        </View>
      )}

      {/* Family Members + Upload */}
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
                    {member.age} yrs • {member.gender} •{' '}
                    {member.is_child ? 'Child' : 'Adult'}
                  </Text>
                </View>
                <View style={[styles.verBadge, { backgroundColor: vColor + '22' }]}>
                  <Text style={[styles.verBadgeText, { color: vColor }]}>
                    {(member.id_verification_status || 'pending').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.uploadSection}>
                <Text style={styles.uploadLabel}>Government ID</Text>
                {idUrl ? (
                  <Image source={{ uri: idUrl }} style={styles.uploadedImage} resizeMode="contain" />
                ) : (
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => pickAndUpload(member.id, 'id')}
                    disabled={!!uploading}
                  >
                    {uploading === `${member.id}_id` ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={20} color={COLORS.primary} />
                        <Text style={styles.uploadButtonText}>Upload ID Proof</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {!member.is_child && (
                <View style={styles.uploadSection}>
                  <Text style={styles.uploadLabel}>Face Photo</Text>
                  {faceUrl ? (
                    <Image source={{ uri: faceUrl }} style={styles.uploadedImage} resizeMode="contain" />
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={() => pickAndUpload(member.id, 'face')}
                      disabled={!!uploading}
                    >
                      {uploading === `${member.id}_face` ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={20} color={COLORS.primary} />
                          <Text style={styles.uploadButtonText}>Upload Photo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Cancellation */}
      {(booking.status === 'confirmed' || booking.status === 'pending') &&
        booking.status !== 'cancel_pending' && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelWithRefund}>
            <Ionicons name="close-circle-outline" size={20} color={COLORS.error} />
            <Text style={styles.cancelText}>Request Cancellation & Refund</Text>
          </TouchableOpacity>
        )}
    </ScrollView>
  );
}

function InfoRow({ label, value, bold, color }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, bold && infoStyles.bold, color && { color }]}>
        {value || '—'}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.xs },
  label: { color: COLORS.textSecondary, fontSize: FONT.md },
  value: { color: COLORS.text, fontSize: FONT.md, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  bold: { fontWeight: '800', color: COLORS.primary, fontSize: FONT.lg },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm },
  badgeText: { fontSize: FONT.sm, fontWeight: '700' },
  ticketCount: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  ticketCountText: { color: COLORS.primary, fontWeight: '700', fontSize: FONT.md },
  inactiveNotice: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.warning + '15', padding: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.warning + '30',
  },
  inactiveText: { color: COLORS.warning, fontSize: FONT.md, flex: 1 },
  memberCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  memberHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  memberName: { fontSize: FONT.base, fontWeight: '700', color: COLORS.text },
  memberMeta: { fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: 2 },
  verBadge: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm },
  verBadgeText: { fontSize: 10, fontWeight: '700' },
  uploadSection: { gap: SPACING.xs },
  uploadLabel: { fontSize: FONT.sm, color: COLORS.textMuted, fontWeight: '600' },
  uploadButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.primary + '40', borderStyle: 'dashed', backgroundColor: COLORS.primary + '08',
  },
  uploadButtonText: { color: COLORS.primary, fontWeight: '600', fontSize: FONT.md },
  uploadedImage: { width: '100%', height: 150, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceLight },
  cancelButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.error + '15', padding: SPACING.md, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.error + '40',
  },
  cancelText: { color: COLORS.error, fontSize: FONT.base, fontWeight: '600' },
  errorText: { color: COLORS.error, fontSize: FONT.base },
});
