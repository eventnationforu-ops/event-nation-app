import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { calculatePricing } from '../src/utils/pricing';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../src/services/paymentService';
import RazorpayCheckout from '../src/components/RazorpayCheckout';
import { COLORS, SPACING, FONT, RADIUS } from '../src/constants/theme';

const EMPTY_MEMBER = { full_name: '', age: '', gender: 'male' };
const MAX_VERIFY_RETRIES = 2;

export default function CheckoutScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user, profile } = useAuth();

  let pkg;
  try {
    pkg = JSON.parse(params.package_json);
  } catch {
    pkg = { name: 'Unknown', base_price: 0, max_adults: 2, max_kids: 2, extra_adult_price: 0 };
  }

  const [phone, setPhone] = useState(profile?.phone || '');
  const [members, setMembers] = useState([{ ...EMPTY_MEMBER }, { ...EMPTY_MEMBER }]);
  const [error, setError] = useState('');

  const [step, setStep] = useState('form');
  const [orderData, setOrderData] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const orderInFlightRef = useRef(false);
  const paymentResultRef = useRef(null);
  const orderDataRef = useRef(null);

  function addMember() {
    if (members.length >= 10) {
      setError('Maximum 10 members per booking');
      return;
    }
    setMembers((prev) => [...prev, { ...EMPTY_MEMBER }]);
  }

  function removeMember(idx) {
    if (members.length <= 2) return;
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMember(idx, field, value) {
    setMembers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  }

  function toggleGender(idx) {
    setMembers((prev) =>
      prev.map((m, i) =>
        i === idx ? { ...m, gender: m.gender === 'male' ? 'female' : 'male' } : m
      )
    );
  }

  const parsedMembers = members.map((m) => ({
    ...m,
    age: parseInt(m.age, 10) || 0,
  }));
  const pricing = calculatePricing(pkg, parsedMembers);

  function validateForm() {
    if (members.length < 2) {
      return 'At least 2 members are required';
    }
    for (let i = 0; i < members.length; i++) {
      if (!members[i].full_name.trim()) {
        return `Member ${i + 1}: Name is required`;
      }
      const age = parseInt(members[i].age, 10);
      if (!age || age <= 0 || age > 150) {
        return `Member ${i + 1}: Valid age (1-150) is required`;
      }
    }

    const adults = parsedMembers.filter((m) => m.age >= 12);
    const kids = parsedMembers.filter((m) => m.age < 12);

    if (adults.length < 2) {
      return 'At least 2 adults (age 12+) are required';
    }
    if (kids.length > 2) {
      return 'Maximum 2 kids (under 12) are allowed per booking';
    }

    if (!phone.trim()) {
      return 'Phone number is required';
    }
    if (!/^\d{10}$/.test(phone.trim())) {
      return 'Please enter a valid 10-digit phone number';
    }
    return null;
  }

  // ── Step 1: Create Razorpay Order ──────────────────────
  const handleProceedToPayment = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (orderInFlightRef.current) return;

    setError('');
    setStep('creating_order');
    orderInFlightRef.current = true;

    try {
      const order = await createRazorpayOrder({
        eventId: params.event_id,
        packageId: params.package_id,
        members: parsedMembers,
        userName: profile?.full_name || user.email,
        phone: phone.trim(),
        email: user.email,
      });

      orderDataRef.current = order;
      setOrderData(order);
      setStep('paying');
      setShowPayment(true);
    } catch (err) {
      setStep('form');
      setError(err.message || 'Failed to create payment order. Please try again.');
    } finally {
      orderInFlightRef.current = false;
    }
  }, [members, phone, params, profile, user]);

  // ── Step 2: Razorpay payment completed → verify ────────
  async function handlePaymentSuccess({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    setShowPayment(false);
    setStep('verifying');

    paymentResultRef.current = { razorpayOrderId, razorpayPaymentId, razorpaySignature };

    await attemptVerification({ razorpayOrderId, razorpayPaymentId, razorpaySignature }, 0);
  }

  async function attemptVerification(paymentData, attempt) {
    const currentOrder = orderDataRef.current;
    if (!currentOrder?.booking_id) {
      setStep('verify_failed');
      setError('Missing booking data. Please contact support.');
      return;
    }

    try {
      await verifyRazorpayPayment({
        razorpayOrderId: paymentData.razorpayOrderId,
        razorpayPaymentId: paymentData.razorpayPaymentId,
        razorpaySignature: paymentData.razorpaySignature,
        bookingId: currentOrder.booking_id,
      });

      setStep('success');
      router.replace({
        pathname: '/success',
        params: {
          booking_id: currentOrder.booking_id,
          total: currentOrder.pricing?.total ?? 0,
          event_title: params.event_title,
          payment_verified: 'true',
        },
      });
    } catch (err) {
      if (attempt < MAX_VERIFY_RETRIES) {
        await new Promise((r) => setTimeout(r, 1500));
        return attemptVerification(paymentData, attempt + 1);
      }

      setStep('verify_failed');
      setError(
        `Payment ID: ${paymentData.razorpayPaymentId}\nBooking ID: ${currentOrder.booking_id}\n\nPlease save these IDs and contact support.`
      );
      Alert.alert(
        'Verification Failed',
        'Your payment was received but could not be verified automatically. Please contact support with your Booking ID.',
        [{ text: 'OK' }]
      );
    }
  }

  function handleRetryVerification() {
    if (!paymentResultRef.current) return;
    setStep('verifying');
    setError('');
    attemptVerification(paymentResultRef.current, 0);
  }

  function handlePaymentFailure(errorMsg) {
    setShowPayment(false);
    setStep('form');
    setError(errorMsg || 'Payment was not completed. You can try again.');
  }

  function handlePaymentDismiss() {
    setShowPayment(false);
    setStep('form');
  }

  // ── UI helpers ─────────────────────────────────────────
  const isLoading = step === 'creating_order' || step === 'verifying';
  const showForm = step === 'form' || step === 'creating_order' || step === 'verify_failed';

  const buttonLabel =
    step === 'creating_order'
      ? 'Creating order...'
      : step === 'verifying'
      ? 'Verifying payment...'
      : step === 'verify_failed'
      ? 'Retry Verification'
      : `Pay ₹${pricing.total.toLocaleString('en-IN')}`;

  const buttonAction =
    step === 'verify_failed' ? handleRetryVerification : handleProceedToPayment;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{params.event_title}</Text>
          <Text style={styles.packageName}>{pkg.name}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Info</Text>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter phone number"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            maxLength={10}
            editable={showForm}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Family Members</Text>
            {showForm && members.length < 10 && (
              <TouchableOpacity style={styles.addButton} onPress={addMember}>
                <Ionicons name="add" size={18} color={COLORS.primary} />
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {members.map((m, idx) => (
            <View key={idx} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <Text style={styles.memberLabel}>Member {idx + 1}</Text>
                {members.length > 2 && showForm && (
                  <TouchableOpacity onPress={() => removeMember(idx)}>
                    <Ionicons name="close-circle" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.input}
                value={m.full_name}
                onChangeText={(v) => updateMember(idx, 'full_name', v)}
                placeholder="Full name"
                placeholderTextColor={COLORS.textMuted}
                maxLength={100}
                editable={showForm}
              />
              <View style={styles.memberRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={m.age}
                  onChangeText={(v) => updateMember(idx, 'age', v.replace(/[^0-9]/g, ''))}
                  placeholder="Age"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  maxLength={3}
                  editable={showForm}
                />
                <TouchableOpacity
                  style={styles.genderToggle}
                  onPress={() => showForm && toggleGender(idx)}
                  disabled={!showForm}
                >
                  <Text style={styles.genderText}>
                    {m.gender === 'male' ? '♂ Male' : '♀ Female'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Price Breakdown</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Adults ({pricing.adults_count})</Text>
            <Text style={styles.priceValue}>
              {pricing.included_adults} included
              {pricing.extra_adults > 0 ? ` + ${pricing.extra_adults} extra` : ''}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Kids ({pricing.kids_count})</Text>
            <Text style={styles.priceValue}>Free</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal</Text>
            <Text style={styles.priceValue}>₹{pricing.subtotal.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>GST (18%)</Text>
            <Text style={styles.priceValue}>₹{pricing.gst.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{pricing.total.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={16} color={COLORS.textMuted} />
          <Text style={styles.noteText}>
            Final amount is calculated securely on the server
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.bookButton, isLoading && styles.bookButtonDisabled]}
          onPress={buttonAction}
          disabled={isLoading || step === 'paying' || step === 'success'}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <View style={styles.bookButtonInner}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.bookButtonText}>{buttonLabel}</Text>
            </View>
          ) : (
            <View style={styles.bookButtonInner}>
              <Ionicons
                name={step === 'verify_failed' ? 'refresh' : 'card-outline'}
                size={20}
                color="#fff"
              />
              <Text style={styles.bookButtonText}>{buttonLabel}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.secureNote}>
          <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} />
          <Text style={styles.secureText}>Secured by Razorpay</Text>
        </View>
      </ScrollView>

      <RazorpayCheckout
        visible={showPayment}
        orderData={orderData}
        onSuccess={handlePaymentSuccess}
        onFailure={handlePaymentFailure}
        onDismiss={handlePaymentDismiss}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  cardTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text },
  packageName: { fontSize: FONT.md, color: COLORS.primary, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  addText: { color: COLORS.primary, fontWeight: '600' },
  label: { color: COLORS.textSecondary, fontSize: FONT.md },
  input: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: FONT.base, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  memberCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  memberHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberLabel: { fontSize: FONT.md, fontWeight: '600', color: COLORS.textSecondary },
  memberRow: { flexDirection: 'row', gap: SPACING.sm },
  genderToggle: { flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  genderText: { color: COLORS.text, fontSize: FONT.md, fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: COLORS.textSecondary, fontSize: FONT.md },
  priceValue: { color: COLORS.text, fontSize: FONT.md, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  totalLabel: { color: COLORS.text, fontSize: FONT.lg, fontWeight: '700' },
  totalValue: { color: COLORS.primary, fontSize: FONT.lg, fontWeight: '800' },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xs },
  noteText: { color: COLORS.textMuted, fontSize: FONT.sm },
  errorBox: { backgroundColor: 'rgba(239, 83, 80, 0.15)', padding: SPACING.md, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.error },
  errorText: { color: COLORS.error, textAlign: 'center', fontSize: FONT.md, lineHeight: 20 },
  bookButton: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center' },
  bookButtonDisabled: { opacity: 0.6 },
  bookButtonInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  bookButtonText: { color: '#fff', fontSize: FONT.lg, fontWeight: '700' },
  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingBottom: SPACING.md },
  secureText: { color: COLORS.textMuted, fontSize: FONT.sm },
});
