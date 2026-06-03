import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Logo } from '../components/Logo';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  innerRadius,
  KineticPressable,
} from '../theme';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  // ─── Business logic preserved verbatim ──────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Focus tracking is the only NEW piece of state — purely visual:
  // it lets us render a branded focus ring instead of the platform default,
  // satisfying the accessibility guideline for keyboard / a11y navigation.
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const response = await api.login(email, password);

      if (response.success) {
        const { user, token } = response;

        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
          navigation.navigate('AdminDashboard', { user, token });
        } else if (user.role === 'EMPLOYEE') {
          navigation.navigate('EmployeeHome', { user, token });
        } else {
          Alert.alert('Error', 'Invalid user role');
        }
      }
    } catch (error: any) {
      const msg = error.message || 'Invalid credentials';
      // Show HR block message prominently inline instead of just an alert
      if (msg.toLowerCase().includes('hr department')) {
        setErrorMessage(msg);
      } else {
        Alert.alert('Login Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Presentation ───────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Warm canvas-toned status bar — no harsh blue band on login */}
      <StatusBar barStyle="dark-content" backgroundColor={palette.canvas} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo: optical centring with breathing room above for visual rest */}
        <View style={styles.logoContainer}>
          <Logo width={180} height={100} />
        </View>

        {/* Title block: hierarchy via scale + weight, not bright color */}
        <View style={styles.titleContainer}>
          <Text style={styles.title} accessibilityRole="header">
            Welcome back
          </Text>
          <Text style={styles.subtitle}>Sign in to mark your attendance</Text>
        </View>

        {/* Credentials: sunken input wells (post-neumorphic "inset" feel)
            with branded focus rings rather than a permanent 2px blue border  */}
        <View style={styles.credentialsSection}>
          <Field label="Email">
            <TextInput
              style={[
                styles.input,
                focusedField === 'email' && styles.inputFocused,
              ]}
              placeholder="you@company.com"
              placeholderTextColor={palette.inkSoft}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              accessibilityLabel="Email address"
            />
          </Field>

          <Field label="Password">
            <TextInput
              style={[
                styles.input,
                focusedField === 'password' && styles.inputFocused,
              ]}
              placeholder="Enter your password"
              placeholderTextColor={palette.inkSoft}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              editable={!loading}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              accessibilityLabel="Password"
            />
          </Field>
        </View>

        {/* Primary CTA: KineticPressable so press feedback is tactile.
            Shadow is post-neumorphic (brand-tinted, low opacity, wide blur)  */}
        <KineticPressable
          style={[
            styles.loginButton,
            loading && styles.loginButtonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityLabel="Sign in"
          accessibilityHint="Tap to log in with the credentials above"
        >
          {loading ? (
            <ActivityIndicator color={palette.inkInverse} />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </KineticPressable>

        {/* HR-block error: muted danger tones rather than alarming pure red */}
        {errorMessage !== '' && (
          <View
            style={styles.errorCard}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Test credentials: dialled down — small, muted, supporting role only */}
        <View style={styles.testCredentials}>
          <Text style={styles.testCredentialsTitle}>Test accounts</Text>
          <Text style={styles.testCredentialsText}>
            <Text style={styles.testCredentialsLabel}>Admin · </Text>
            admin@solutionone.com / admin123
          </Text>
          <Text style={styles.testCredentialsText}>
            <Text style={styles.testCredentialsLabel}>Employee · </Text>
            employee1@solutionone.com / emp123
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
 * Field — small co-located atom for "label + input" pairs.
 * Keeps the JSX tidy and ensures consistent label typography everywhere.
 * ────────────────────────────────────────────────────────────────────────── */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <View style={styles.fieldWrapper}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  // ── Canvas ───────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    // Warm-cream canvas instead of #F5F5F5 — luxurious and easier on eyes
    backgroundColor: palette.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    // 8px grid: 32px horizontal (4 units) + 24px vertical (3 units)
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
  },

  // ── Logo block ───────────────────────────────────────────────────────────
  logoContainer: {
    alignItems: 'center',
    // 24px gap below logo — 3 spatial units, matches title block top breathing
    marginBottom: spacing.xxl,
  },

  // ── Title block ──────────────────────────────────────────────────────────
  titleContainer: {
    alignItems: 'center',
    // 40px before form fields creates a generous editorial rest
    marginBottom: spacing['4xl'],
  },
  title: {
    ...typography.display,
    // Ink-mocha instead of brand-blue — typography hierarchy via scale, not color
    color: palette.inkStrong,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    // Muted ink (5:1 contrast) — supporting, not competing
    color: palette.inkMuted,
  },

  // ── Field wrapper + label ────────────────────────────────────────────────
  credentialsSection: {
    marginBottom: spacing.xxl,
  },
  fieldWrapper: {
    // 16px stack gap between fields
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    marginBottom: spacing.sm,
    // Slight letter-spacing makes overlines feel intentional
    letterSpacing: 0.3,
  },

  // ── Input wells (post-neumorphic sunken feel) ────────────────────────────
  input: {
    backgroundColor: palette.surfaceSunken,
    // 12px radius — sits well inside the 32px screen padding rhythm
    borderRadius: radii.md,
    // Hairline border by default; focus state swaps to branded ring
    borderWidth: 1,
    borderColor: palette.borderHairline,
    paddingHorizontal: spacing.lg,
    // 16px vertical padding → 56px total height (8 grid * 7 = matches button)
    paddingVertical: spacing.lg,
    ...typography.bodyLarge,
    color: palette.inkStrong,
    // M3-style inset feel: zero shadow, slightly recessed colour palette
  },
  inputFocused: {
    // Branded focus ring — replaces the default browser outline & the
    // previous always-on 2px blue border (which was visually noisy).
    borderColor: palette.brandDeep,
    borderWidth: 2,
    backgroundColor: palette.surface,
  },

  // ── Primary CTA ──────────────────────────────────────────────────────────
  loginButton: {
    backgroundColor: palette.brandDeep,
    // 16px radius pairs with the 16px input radius for harmonic rhythm
    borderRadius: radii.lg,
    // 56px total height keeps it tappable & matches input height
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    // Multi-layered post-neumorphic shadow — wide blur, low opacity
    ...elevation.level3,
  },
  loginButtonDisabled: {
    // Soft fade rather than ugly grey — feels intentional
    opacity: 0.55,
  },
  loginButtonText: {
    ...typography.buttonLarge,
    color: palette.inkInverse,
  },

  // ── Error card ───────────────────────────────────────────────────────────
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.dangerSoft,
    borderRadius: radii.md,
    // 1px hairline border (not 2px) — danger-soft bg already conveys urgency
    borderWidth: 1,
    borderColor: palette.dangerBase,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
    ...elevation.level1,
  },
  errorIcon: {
    ...typography.subtitle,
    color: palette.dangerDeep,
    // Optical centring: glyph sits slightly above baseline, this nudges it down
    marginTop: 1,
  },
  errorText: {
    ...typography.body,
    color: palette.dangerInk,
    flex: 1,
    // 1.5 line-height already baked into typography.body for readability
  },

  // ── Test credentials (de-emphasised supporting copy) ─────────────────────
  testCredentials: {
    backgroundColor: palette.surface,
    // Nesting formula: outer card is 12px radius with 16px padding,
    // so any inner element gets radius 0 (max(0, 12-16) = 0)
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    // Whisper-level shadow — almost flat
    ...elevation.level1,
  },
  testCredentialsTitle: {
    ...typography.overline,
    color: palette.inkMuted,
    marginBottom: spacing.md,
  },
  testCredentialsText: {
    ...typography.caption,
    color: palette.inkMuted,
    // Small gap between rows — 4px micro-adjust (allowed inside dense block)
    marginBottom: spacing.xs,
  },
  testCredentialsLabel: {
    // Inline label emphasis without changing color → typography hierarchy
    fontWeight: '700',
    color: palette.inkBase,
  },
});
