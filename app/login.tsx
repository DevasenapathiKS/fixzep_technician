import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppLogo from '@/components/ui/app-logo';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { captureFaceImageBase64 } from '@/lib/capture-face-base64';
import type { VerifyOtpResult } from '@/types/api';

const OTP_LENGTH = 4;

const heroStats = [
  { label: 'Avg. rating', value: '4.9/5' },
  { label: 'Jobs completed', value: '2,450+' },
  { label: 'SLA compliance', value: '98%' },
];

type Step = 'phone' | 'otp' | 'security';

export default function LoginScreen() {
  const queryClient = useQueryClient();
  const {
    sendOtp,
    verifyOtp,
    completeTechnicianLogin,
    applyTechnicianSession,
    isAuthenticated,
    bootstrapping,
  } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [reqId, setReqId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [preAuth, setPreAuth] = useState<VerifyOtpResult | null>(null);
  const faceEnrollmentInFlightRef = useRef(false);

  const { height } = useWindowDimensions();
  const isCompact = height < 720;
  const scrollRef = useRef<ScrollView>(null);
  const otpInputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!bootstrapping && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [bootstrapping, isAuthenticated]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  const cleanPhone = useMemo(() => phone.replace(/\D/g, ''), [phone]);
  const isPhoneValid = cleanPhone.length === 10;
  const isOtpValid = otp.length === OTP_LENGTH;

  const extractErrorMessage = (error: unknown): string => {
    if (typeof error === 'object' && error !== null) {
      const err = error as any;
      if (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK') {
        return 'Network error. Please check your connection and try again.';
      }
      if (err.code === 'ECONNABORTED') {
        return 'Request timed out. Please try again.';
      }
      if (err.response?.data?.message) {
        return err.response.data.message;
      }
      if (err.message) {
        return err.message;
      }
    }
    if (typeof error === 'string') return error;
    return 'Something went wrong. Please try again.';
  };

  const handleSendOtp = async () => {
    if (!isPhoneValid || submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const id = await sendOtp(cleanPhone);
      setReqId(id);
      setStep('otp');
      setOtp('');
      setResendTimer(30);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!isOtpValid || submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const result = await verifyOtp(cleanPhone, otp, reqId);
      if (result.session && !result.needsFaceEnrollment) {
        await applyTechnicianSession(result.session);
        await queryClient.invalidateQueries({ queryKey: ['technicianProfile'] });
        router.replace('/(tabs)');
        return;
      }
      setPreAuth(result);
      setStep('security');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setOtp('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFaceCamera = async () => {
    if (!preAuth || submitting || faceEnrollmentInFlightRef.current) return;
    faceEnrollmentInFlightRef.current = true;
    setErrorMessage(null);
    try {
      const captured = await captureFaceImageBase64();
      if (!captured.ok) {
        if (captured.reason === 'canceled' || captured.reason === 'busy') return;
        if (captured.reason === 'no_permission') {
          setErrorMessage('Camera access is required for face verification.');
          return;
        }
        setErrorMessage(
          'Could not read the photo from your device. Try again, or disable photo filters if any.'
        );
        return;
      }
      if (!preAuth.preAuthToken?.trim()) {
        setErrorMessage('Session expired. Go back and verify OTP again.');
        return;
      }
      setSubmitting(true);
      try {
        await completeTechnicianLogin(preAuth.preAuthToken, {
          method: 'face_image',
          faceImageBase64: captured.base64,
        });
        await queryClient.invalidateQueries({ queryKey: ['technicianProfile'] });
        router.replace('/(tabs)');
      } catch (error) {
        setErrorMessage(extractErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    } finally {
      faceEnrollmentInFlightRef.current = false;
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const id = await sendOtp(cleanPhone);
      setReqId(id);
      setOtp('');
      setResendTimer(30);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'security') {
      setStep('otp');
      setPreAuth(null);
      setErrorMessage(null);
      return;
    }
    setStep('phone');
    setOtp('');
    setReqId('');
    setPreAuth(null);
    setErrorMessage(null);
  };

  const formattedPhone = cleanPhone.length === 10
    ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`
    : phone;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: isCompact ? 20 : 36,
              paddingBottom: keyboardVisible ? 40 : isCompact ? 24 : 32,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero / Brand section */}
          {!keyboardVisible && step !== 'security' ? (
            <View style={[styles.heroPanel, isCompact && styles.heroPanelCompact]}>
              <View style={styles.heroBrandRow}>
                <AppLogo size={isCompact ? 28 : 32} />
                <Text style={styles.heroBrandText}>FixZep</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>FixZep Technician Suite</Text>
              </View>
              <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                Deliver service excellence.
              </Text>
              <Text style={[styles.heroSubtitle, isCompact && styles.heroSubtitleCompact]}>
                Track schedules, capture work logs, and stay on top of notifications from a single
                secure workspace.
              </Text>
              <View style={styles.heroStatsRow}>
                {heroStats.map((stat) => (
                  <View key={stat.label} style={[styles.heroStat, isCompact && styles.heroStatCompact]}>
                    <Text style={[styles.heroStatValue, isCompact && styles.heroStatValueCompact]}>
                      {stat.value}
                    </Text>
                    <Text style={styles.heroStatLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.heroCollapsed}>
              <AppLogo size={24} />
              <Text style={styles.heroBrandText}>FixZep</Text>
            </View>
          )}

          {/* Form card */}
          <View style={[styles.formCard, isCompact && styles.formCardCompact]}>
            {step === 'phone' && (
              <>
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>Sign in to continue</Text>
                  <Text style={styles.formSubtitle}>
                    Enter your registered mobile number to receive an OTP.
                  </Text>
                </View>

                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorTitle}>Unable to send OTP</Text>
                    <Text style={styles.errorSubtitle}>{errorMessage}</Text>
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.label}>Mobile number</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCode}>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      value={phone}
                      onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
                      keyboardType="phone-pad"
                      placeholder="Enter 10-digit number"
                      placeholderTextColor="#9ca3af"
                      style={styles.phoneInput}
                      maxLength={10}
                      returnKeyType="done"
                      onSubmitEditing={handleSendOtp}
                      onFocus={() => {
                        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
                      }}
                    />
                  </View>
                </View>

                <Pressable
                  disabled={!isPhoneValid || submitting}
                  style={[styles.button, (!isPhoneValid || submitting) && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>Get OTP</Text>
                  )}
                </Pressable>
              </>
            )}
            {step === 'otp' && (
              <>
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>Verify OTP</Text>
                  <Text style={styles.formSubtitle}>
                    Enter the {OTP_LENGTH}-digit code sent to{' '}
                    <Text style={styles.phoneHighlight}>{formattedPhone}</Text>
                  </Text>
                </View>

                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorTitle}>Verification failed</Text>
                    <Text style={styles.errorSubtitle}>{errorMessage}</Text>
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.label}>OTP</Text>
                  <TextInput
                    ref={otpInputRef}
                    value={otp}
                    onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))}
                    keyboardType="number-pad"
                    placeholder="Enter OTP"
                    placeholderTextColor="#9ca3af"
                    style={[styles.input, styles.otpInput]}
                    maxLength={OTP_LENGTH}
                    returnKeyType="done"
                    onSubmitEditing={handleVerifyOtp}
                    autoFocus
                    onFocus={() => {
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
                    }}
                  />
                </View>

                <Pressable
                  disabled={!isOtpValid || submitting}
                  style={[styles.button, (!isOtpValid || submitting) && styles.buttonDisabled]}
                  onPress={handleVerifyOtp}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify & Sign In</Text>
                  )}
                </Pressable>

                <View style={styles.otpFooter}>
                  <Pressable onPress={handleBack}>
                    <Text style={styles.linkText}>Change number</Text>
                  </Pressable>

                  <Pressable onPress={handleResend} disabled={resendTimer > 0}>
                    <Text style={[styles.linkText, resendTimer > 0 && styles.linkDisabled]}>
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
            {step === 'security' && preAuth && (
              <>
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>Enroll your face</Text>
                  <Text style={styles.formSubtitle}>
                    One-time setup: take a clear selfie. We store a secure fingerprint only — not the picture. After
                    this, you sign in with OTP only. Punch in and out on the home screen will ask for a quick face check
                    each time.
                  </Text>
                </View>

                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorTitle}>Could not enroll</Text>
                    <Text style={styles.errorSubtitle}>{errorMessage}</Text>
                  </View>
                )}

                <Pressable
                  disabled={submitting}
                  style={[styles.button, submitting && styles.buttonDisabled]}
                  onPress={handleFaceCamera}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>Take enrollment photo</Text>
                  )}
                </Pressable>

                <Pressable onPress={handleBack} disabled={submitting}>
                  <Text style={styles.linkText}>Back to OTP</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    fontFamily: Fonts?.sans,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 16,
  },
  heroPanel: {
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    backgroundColor: '#f9fafb',
  },
  heroPanelCompact: {
    padding: 18,
  },
  heroCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    fontFamily: Fonts?.sans,
  },
  heroBrandText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  heroBadgeText: {
    color: '#6b7280',
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: Fonts?.sans,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    fontFamily: Fonts?.sans,
  },
  heroTitleCompact: {
    fontSize: 24,
    fontFamily: Fonts?.sans,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
    fontFamily: Fonts?.sans,
  },
  heroSubtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  heroStat: {
    flexBasis: '33%',
    paddingRight: 12,
    marginBottom: 12,
  },
  heroStatCompact: {
    flexBasis: '50%',
    paddingRight: 8,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  heroStatValueCompact: {
    fontSize: 16,
  },
  heroStatLabel: {
    color: '#9ca3af',
    marginTop: 4,
    fontSize: 12,
    letterSpacing: 0.4,
    fontFamily: Fonts?.sans,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#111827',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  formCardCompact: {
    padding: 18,
  },
  formHeader: {
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  formSubtitle: {
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 20,
    fontFamily: Fonts?.sans,
  },
  phoneHighlight: {
    fontWeight: '600',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  field: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    fontFamily: Fonts?.sans,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryCode: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f3f4f6',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: Fonts?.sans,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
    letterSpacing: 1,
    fontFamily: Fonts?.sans,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
    fontFamily: Fonts?.sans,
  },
  otpInput: {
    letterSpacing: 8,
    fontSize: 22,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: Fonts.bold,
  },
  errorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 12,
    marginBottom: 8,
  },
  errorTitle: {
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 2,
    fontFamily: Fonts?.sans,
  },
  errorSubtitle: {
    color: '#991b1b',
    fontFamily: Fonts?.sans,
  },
  button: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  buttonSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  buttonSecondaryText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  otpFooter: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: Fonts?.sans,
  },
  linkDisabled: {
    color: '#9ca3af',
    fontWeight: '400',
  },
});
