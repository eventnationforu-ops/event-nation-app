import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/constants/theme';

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/(tabs)');
    }
  }, [isAdmin, loading]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin Panel' }} />
      <Stack.Screen name="booking/[id]" options={{ title: 'Booking Details' }} />
      <Stack.Screen name="scanner" options={{ title: 'QR Scanner' }} />
      <Stack.Screen name="checkin-dashboard" options={{ title: 'Check-in Dashboard' }} />
      <Stack.Screen name="refunds" options={{ title: 'Refund Management' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
    </Stack>
  );
}
