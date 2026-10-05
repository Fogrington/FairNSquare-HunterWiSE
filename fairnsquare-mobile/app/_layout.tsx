import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function AuthGuard() {
  const { judge, restoring } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait one tick for the navigator to mount
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Don't make routing decisions until we know whether a saved
    // session exists — otherwise a logged-in judge briefly flashes
    // the login screen on every app relaunch.
    if (!ready || restoring) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!judge && inAuthGroup) {
      router.replace('/login' as any);
    } else if (judge && (segments[0] as string) === 'login') {
      router.replace('/(tabs)' as any);
    }
  }, [ready, restoring, judge, segments]);

  if (restoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4F8' }}>
        <ActivityIndicator size="large" color="#7DD3EA" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGuard />
    </AuthProvider>
  );
}
