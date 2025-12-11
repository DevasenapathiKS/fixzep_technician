import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { useAuth } from '@/hooks/useAuth';

const heroStats = [
  { label: 'Avg. rating', value: '4.9/5' },
  { label: 'Jobs completed', value: '2,450+' },
  { label: 'SLA compliance', value: '98%' }
];

export default function LoginScreen() {
  const { login, isAuthenticated, bootstrapping } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bootstrapping && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [bootstrapping, isAuthenticated]);

  const isFormValid = useMemo(() => email.trim().length > 0 && password.trim().length > 0, [email, password]);

  const extractErrorMessage = (error: unknown) => {
    const fallback = 'Unable to sign in. Check your credentials and try again.';
    if (typeof error === 'string') {
      return error;
    }
    if (typeof error === 'object' && error !== null) {
      const maybeResponse = (error as { response?: { data?: { message?: string } } }).response;
      if (maybeResponse?.data?.message) {
        return maybeResponse.data.message;
      }
      const maybeMessage = (error as { message?: string }).message;
      if (maybeMessage) {
        return maybeMessage;
      }
    }
    return fallback;
  };

  const handleLogin = async () => {
    if (!isFormValid || submitting) {
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (error) {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      console.error('Login failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[ '#030712', '#081229', '#0f172a' ]} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}
        >
          <View style={styles.heroPanel}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>FixZep Technician Suite</Text>
            </View>
            <Text style={styles.heroTitle}>Deliver service excellence.</Text>
            <Text style={styles.heroSubtitle}>
              Track schedules, capture work logs, and stay on top of notifications from a single
              secure workspace.
            </Text>
            <View style={styles.heroStatsRow}>
              {heroStats.map((stat) => (
                <View key={stat.label} style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{stat.value}</Text>
                  <Text style={styles.heroStatLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Sign in to continue</Text>
              <Text style={styles.formSubtitle}>Use your FixZep technician credentials.</Text>
            </View>

            {errorMessage && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorTitle}>Authentication failed</Text>
                <Text style={styles.errorSubtitle}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="tech@example.com"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            <View style={[styles.field, styles.fieldSpacing]}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <Pressable
              disabled={!isFormValid || submitting}
              style={[styles.button, (!isFormValid || submitting) && styles.buttonDisabled]}
              onPress={handleLogin}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Access dashboard</Text>}
            </Pressable>

            <View style={styles.formFooter}>
              <Text style={styles.formFooterText}>Need help?</Text>
              <Pressable>
                <Text style={styles.supportLink}>Contact dispatcher</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>

        <View style={styles.decorateOrb} pointerEvents="none" />
        <View style={styles.decorateBar} pointerEvents="none" />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030712'
  },
  gradient: {
    flex: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    justifyContent: 'space-between'
  },
  heroPanel: {
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    backgroundColor: 'rgba(15,23,42,0.65)'
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16
  },
  heroBadgeText: {
    color: '#cbd5f5',
    fontSize: 12,
    letterSpacing: 0.5
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(248,250,252,0.7)',
    lineHeight: 22
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    flexWrap: 'wrap'
  },
  heroStat: {
    flexBasis: '33%',
    paddingRight: 12,
    marginBottom: 12
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9'
  },
  heroStatLabel: {
    color: '#cbd5f5',
    marginTop: 4,
    fontSize: 12,
    letterSpacing: 0.4
  },
  formCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  formHeader: {
    marginBottom: 12
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a'
  },
  formSubtitle: {
    color: '#475569'
  },
  field: {
    marginTop: 8
  },
  fieldSpacing: {
    marginTop: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b'
  },
  errorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
    backgroundColor: 'rgba(248,113,113,0.12)',
    padding: 12,
    marginBottom: 8
  },
  errorTitle: {
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 2
  },
  errorSubtitle: {
    color: '#7f1d1d'
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#fff'
  },
  button: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563eb'
  },
  buttonDisabled: {
    opacity: 0.65
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  formFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  formFooterText: {
    color: '#475569'
  },
  supportLink: {
    color: '#2563eb',
    fontWeight: '600'
  },
  decorateOrb: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(59,130,246,0.15)',
    top: 60,
    right: -40
  },
  decorateBar: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 28,
    backgroundColor: 'rgba(14,165,233,0.25)',
    bottom: 50,
    left: -30,
    transform: [{ rotate: '-15deg' }]
  }
});
