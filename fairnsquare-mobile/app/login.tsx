import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const { login, loading, error } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [localError, setLocalError] = useState('');

  const handleLogin = async () => {
    setLocalError('');
    if (!email.trim() || !accessCode.trim()) {
      setLocalError('Please enter your email and access code.');
      return;
    }
    const success = await login(email.trim(), accessCode.trim());
    if (success) {
      router.replace('/(tabs)' as any);
    } else {
      setLocalError(error || 'Invalid email or access code.');
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.headerCard}>
          <Text style={styles.appName}>FairN²</Text>
          <Text style={styles.headerSub}>Judge Portal</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@organisation.com"
            placeholderTextColor="#90A4AE"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />

          <Text style={styles.label}>Access Code</Text>
          <TextInput
            style={styles.input}
            placeholder="4-digit code"
            placeholderTextColor="#90A4AE"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={accessCode}
            onChangeText={setAccessCode}
            editable={!loading}
          />

          {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLeft}>FairN²</Text>
          <Text style={styles.footerRight}>
            <Text style={styles.footerHunter}>HUNTER</Text>
            <Text style={styles.footerWise}>wise</Text>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  headerCard: {
    backgroundColor: '#7DD3EA',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  appName: { fontSize: 42, fontWeight: '800', color: '#000' },
  headerSub: { fontSize: 16, color: '#000', marginTop: 4 },
  formSection: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#B0BEC5',
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000',
  },
  errorText: { color: '#C62828', fontSize: 13, marginTop: 10 },
  button: {
    backgroundColor: '#7DD3EA',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#B0BEC5',
    paddingTop: 12,
    marginTop: 16,
  },
  footerLeft: { fontSize: 13, fontWeight: '800', color: '#000' },
  footerRight: { fontSize: 14 },
  footerHunter: { fontWeight: '700', color: '#000' },
  footerWise: { fontStyle: 'italic', color: '#0277BD' },
});