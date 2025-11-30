import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';
import { MarkdownText } from '../../components/MarkdownText';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../../constants/theme';

interface HealthProfile {
  sleep_pattern: string;
  sleep_hours: number;
  hydration_level: string;
  stress_level: string;
  exercise_frequency: string;
  diet_type: string;
  health_persona?: string;
}

export default function Profile() {
  const { username, logout } = useAuth();
  const { token } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
  const response = await axios.get(`${API_BASE_URL}/api/health/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setProfile(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      // Encode the token to make it URL-safe
      const encodedToken = encodeURIComponent(token || '');
      
      // Create URL with token as query parameter for the backend to accept
      const pdfUrl = `${API_BASE_URL}/api/health/generate-report?token=${encodedToken}`;
      
      // Try to open the URL in browser/PDF viewer
      const canOpen = await Linking.canOpenURL(pdfUrl);
      
      if (canOpen) {
        await Linking.openURL(pdfUrl);
        Alert.alert('Success', 'Opening your health report...');
      } else {
        // Fallback: show URL to user
        Alert.alert(
          'Report Ready',
          'Your health report is ready. Please copy this URL and open it in your browser:\n\n' + pdfUrl,
          [
            {
              text: 'OK',
              onPress: () => console.log('PDF URL:', pdfUrl)
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate health report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const handleUpdateProfile = () => {
    router.push('/onboarding/questions');
  };

  const formatLabel = (key: string, value: string | number): string => {
    if (typeof value === 'number') return `${value} hours`;
    return value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <LinearGradient
        colors={colors.backgroundGradient}
        style={styles.centerContainer}
      >
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={colors.backgroundGradient}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color="#6366F1" />
            </View>
          </View>
          <Text style={styles.username}>{username}</Text>
        </View>

        {profile?.health_persona && (
          <View style={styles.personaCard}>
            <View style={styles.personaHeader}>
              <Ionicons name="sparkles" size={24} color="#F59E0B" />
              <Text style={styles.personaTitle}>Your Health Persona</Text>
            </View>
            <MarkdownText content={profile.health_persona} variant="light" />
          </View>
        )}

        {profile && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Health Profile</Text>
              <TouchableOpacity onPress={handleUpdateProfile}>
                <Ionicons name="create-outline" size={24} color="#6366F1" />
              </TouchableOpacity>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Ionicons name="moon" size={24} color="#6366F1" />
                <Text style={styles.infoLabel}>Sleep Pattern</Text>
                <Text style={styles.infoValue}>{formatLabel('sleep_pattern', profile.sleep_pattern)}</Text>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="time" size={24} color="#6366F1" />
                <Text style={styles.infoLabel}>Sleep Hours</Text>
                <Text style={styles.infoValue}>{profile.sleep_hours}h</Text>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="water" size={24} color="#06B6D4" />
                <Text style={styles.infoLabel}>Hydration</Text>
                <Text style={styles.infoValue}>{formatLabel('hydration', profile.hydration_level)}</Text>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="pulse" size={24} color="#F59E0B" />
                <Text style={styles.infoLabel}>Stress Level</Text>
                <Text style={styles.infoValue}>{formatLabel('stress', profile.stress_level)}</Text>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="fitness" size={24} color="#10B981" />
                <Text style={styles.infoLabel}>Exercise</Text>
                <Text style={styles.infoValue}>{formatLabel('exercise', profile.exercise_frequency)}</Text>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="restaurant" size={24} color="#8B5CF6" />
                <Text style={styles.infoLabel}>Diet Type</Text>
                <Text style={styles.infoValue}>{formatLabel('diet', profile.diet_type)}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleGenerateReport}
            disabled={isGeneratingReport}
          >
            <Ionicons name="document-text-outline" size={24} color="#6366F1" />
            <Text style={[styles.actionButtonText, { color: '#6366F1' }]}>
              {isGeneratingReport ? 'Generating Report...' : 'Generate Health Report'}
            </Text>
            {isGeneratingReport ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            <Text style={styles.actionButtonText}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>
      </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 100,
  },
  profileCard: {
    backgroundColor: colors.surfaceBg,
    borderRadius: spacing.cardRadius,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#6366F1',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  personaCard: {
    backgroundColor: colors.surfaceBg,
    borderRadius: spacing.cardRadius,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#F59E0B30',
  },
  personaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  personaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 8,
  },
  personaText: {
    fontSize: 16,
    color: '#F1F5F9',
    lineHeight: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCard: {
    backgroundColor: colors.surfaceBg,
    borderRadius: spacing.cardRadius,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginTop: 4,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceBg,
    borderRadius: spacing.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 12,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
    marginLeft: 12,
  },
});
