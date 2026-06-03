import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppMain from './AppMain';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { shouldShowOnboarding } from './lib/onboardingStorage';

export default function AppRoot() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    shouldShowOnboarding()
      .then(setShowOnboarding)
      .catch(() => setShowOnboarding(true))
      .finally(() => setReady(true));
  }, []);

  return (
    <SafeAreaProvider>
      {!ready ? (
        <SafeAreaView style={styles.boot}>
          <Text style={styles.bootText}>回响之森</Text>
        </SafeAreaView>
      ) : showOnboarding ? (
        <OnboardingFlow
          onSkip={() => setShowOnboarding(false)}
          onComplete={() => setShowOnboarding(false)}
        />
      ) : (
        <AppMain />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050B09' },
  bootText: { color: '#DDE6E0', fontSize: 24, fontWeight: '700' },
});
