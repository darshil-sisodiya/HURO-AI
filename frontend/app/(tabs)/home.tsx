import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../components/GlassCard';
import { QuickActionCard } from '../../components/QuickActionCard';
import { MarkdownText } from '../../components/MarkdownText';
import { useRouter } from 'expo-router';

const BACKEND_URL = API_BASE_URL;

type EntryType = 'symptom' | 'mood' | 'medicine' | 'sleep' | 'hydration' | 'exercise' | 'note';

interface TimelineEntry {
  id: string;
  entry_type: EntryType;
  title: string;
  description?: string;
  severity?: number;
  tags: string[];
  timestamp: string;
}

interface QuickActionConfig {
  key: 'chat' | 'body' | 'challenges' | 'insights';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  colors: [string, string];
  route: '/(tabs)/chat' | '/(tabs)/bodymap' | '/(tabs)/challenges' | '/(tabs)/insights';
}

const entryTypeConfig: Record<EntryType, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  symptom: { icon: 'medkit', color: '#EF4444', label: 'Symptom' },
  mood: { icon: 'happy', color: '#F59E0B', label: 'Mood' },
  medicine: { icon: 'medical', color: '#10B981', label: 'Medicine' },
  sleep: { icon: 'moon', color: '#6366F1', label: 'Sleep' },
  hydration: { icon: 'water', color: '#06B6D4', label: 'Hydration' },
  exercise: { icon: 'fitness', color: '#EC4899', label: 'Exercise' },
  note: { icon: 'document-text', color: '#8B5CF6', label: 'Note' },
};

const getTrendMeta = (trend?: string) => {
  switch (trend) {
    case 'increasing':
      return { label: 'Trending Up', color: '#F87171', icon: 'arrow-up' as const };
    case 'decreasing':
      return { label: 'Improving', color: '#34D399', icon: 'arrow-down' as const };
    case 'stable':
      return { label: 'Holding Steady', color: '#60A5FA', icon: 'remove' as const };
    case 'good':
      return { label: 'On Track', color: '#22D3EE', icon: 'checkmark' as const };
    case 'needs_improvement':
      return { label: 'Needs Attention', color: '#FBBF24', icon: 'alert-circle' as const };
    default:
      return { label: 'No Recent Data', color: '#94A3B8', icon: 'ellipsis-horizontal' as const };
  }
};

export default function Home() {
  const { token } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<EntryType>('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moodCategory, setMoodCategory] = useState<string | null>(null);
  const [moodIntensity, setMoodIntensity] = useState<'low' | 'medium' | 'high' | null>(null);
  const [medicineName, setMedicineName] = useState('');
  const [medicineTime, setMedicineTime] = useState<'morning' | 'afternoon' | 'evening' | 'night' | null>(null);
  const [sleepHours, setSleepHours] = useState<string>('');
  const [sleepQuality, setSleepQuality] = useState<'great' | 'ok' | 'restless' | null>(null);
  const [hydrationCups, setHydrationCups] = useState<number | null>(null);
  const [symptomLocation, setSymptomLocation] = useState<string | null>(null);
  const [exerciseType, setExerciseType] = useState<string | null>(null);
  const [exerciseDuration, setExerciseDuration] = useState<string | null>(null);
  const [exerciseIntensity, setExerciseIntensity] = useState<'light' | 'moderate' | 'vigorous' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [healthProfile, setHealthProfile] = useState<any>(null);
  const [activeChallenges, setActiveChallenges] = useState<any[]>([]);

  const scrollViewRef = useRef<ScrollView>(null);

  const trends = insights?.trends || {};

  const healthScore = useMemo(() => {
    if (insights?.ai_health_score?.score != null) {
      const raw = Number(insights.ai_health_score.score) || 0;
      return Math.max(0, Math.min(100, Math.round(raw)));
    }
    // Fallback to rough heuristic when AI score is missing
    if (!insights) return 78;
    const baseScore = 92;
    const symptomPenalty = Math.min((insights.symptoms_this_month || 0) * 2.4, 28);
    const stressBonus = Math.min(insights.stress_free_days || 0, 12);
    const hydrationBonus = Math.min((insights.hydration_logs || 0) * 0.4, 8);
    return Math.max(50, Math.min(100, Math.round(baseScore - symptomPenalty + stressBonus + hydrationBonus)));
  }, [insights]);
  const symptomMeta = useMemo(
    () => getTrendMeta(trends.symptom_trend || insights?.symptom_trend),
    [trends.symptom_trend, insights?.symptom_trend]
  );
  const hydrationMeta = useMemo(
    () => getTrendMeta(trends.hydration_trend || insights?.hydration_trend),
    [trends.hydration_trend, insights?.hydration_trend]
  );

  const loadEntries = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/timeline/entries?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntries(response.data);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  }, [token]);

  const loadQuickInsights = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/insights/patterns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInsights(response.data);
    } catch (error) {
      console.error('Error loading insights:', error);
    }
  }, [token]);

  const loadHealthProfile = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/health/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHealthProfile(response.data);
    } catch (error) {
      console.error('Error loading health profile:', error);
    }
  }, [token]);

  const loadActiveChallenges = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/challenges/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveChallenges(response.data);
    } catch (error) {
      console.error('Error loading challenges:', error);
    }
  }, [token]);

  const loadAllData = useCallback(
    async (showFullScreen = false) => {
      if (showFullScreen) {
        setIsLoading(true);
      }
      setRefreshing(true);
      try {
        await Promise.all([
          loadEntries(),
          loadQuickInsights(),
          loadHealthProfile(),
          loadActiveChallenges(),
        ]);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [loadEntries, loadQuickInsights, loadHealthProfile, loadActiveChallenges]
  );

  useEffect(() => {
    loadAllData(true);
  }, [loadAllData]);

  const onRefresh = useCallback(() => {
    loadAllData(false);
  }, [loadAllData]);

  const resetEntryForm = () => {
    setTitle('');
    setDescription('');
    setMoodCategory(null);
    setMoodIntensity(null);
    setMedicineName('');
    setMedicineTime(null);
    setSleepHours('');
    setSleepQuality(null);
    setHydrationCups(null);
    setSymptomLocation(null);
    setExerciseType(null);
    setExerciseDuration(null);
    setExerciseIntensity(null);
  };

  const handleAddEntry = async () => {
    let finalTitle = title.trim();

    if (selectedType === 'medicine') {
      if (!medicineName.trim()) {
        Alert.alert('Error', 'Please enter the medicine name');
        return;
      }
      if (!finalTitle) {
        finalTitle = medicineName.trim();
      }
    }

    if (!finalTitle) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    const tags: string[] = [];
    if (selectedType === 'mood') {
      if (moodCategory) tags.push(`mood:${moodCategory}`);
      if (moodIntensity) tags.push(`intensity:${moodIntensity}`);
    }
    if (selectedType === 'medicine') {
      tags.push(`med:${medicineName.trim()}`);
      if (medicineTime) tags.push(`time:${medicineTime}`);
    }
    if (selectedType === 'sleep') {
      if (sleepHours.trim()) tags.push(`sleep:${sleepHours.trim()}h`);
      if (sleepQuality) tags.push(`quality:${sleepQuality}`);
    }
    if (selectedType === 'hydration') {
      if (hydrationCups !== null) tags.push(`cups:${hydrationCups}`);
    }
    if (selectedType === 'symptom') {
      if (symptomLocation) tags.push(`location:${symptomLocation}`);
    }
    if (selectedType === 'exercise') {
      if (exerciseType) tags.push(`type:${exerciseType}`);
      if (exerciseDuration) tags.push(`duration:${exerciseDuration}`);
      if (exerciseIntensity) tags.push(`intensity:${exerciseIntensity}`);
    }

    setIsSaving(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/timeline/entry`,
        {
          entry_type: selectedType,
          title: finalTitle,
          description: description.trim() || undefined,
          tags,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setModalVisible(false);
      resetEntryForm();
      await loadEntries();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add entry');
    } finally {
      setIsSaving(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 85) return '#10B981';
    if (score >= 70) return '#F59E0B';
    return '#EF4444';
  };

  const quickActions: QuickActionConfig[] = [
    {
      key: 'chat',
      icon: 'chatbubbles' as const,
      title: 'AI Chat',
      subtitle: 'Your health companion',
      colors: ['#6366F1', '#8B5CF6'] as [string, string],
      route: '/(tabs)/chat',
    },
    {
      key: 'body',
      icon: 'body' as const,
      title: 'Body Map',
      subtitle: 'Log how you feel',
      colors: ['#EC4899', '#F43F5E'] as [string, string],
      route: '/(tabs)/bodymap',
    },
    {
      key: 'challenges',
      icon: 'trophy' as const,
      title: 'Challenges',
      subtitle: 'Stay on track',
      colors: ['#F59E0B', '#FBBF24'] as [string, string],
      route: '/(tabs)/challenges',
    },
    {
      key: 'insights',
      icon: 'analytics' as const,
      title: 'Insights',
      subtitle: 'Spot patterns',
      colors: ['#10B981', '#14B8A6'] as [string, string],
      route: '/(tabs)/insights',
    },
  ];

  const focusCards = useMemo(
    () => [
      {
        key: 'symptoms',
        title: 'Symptom pattern',
        meta: symptomMeta,
        caption: 'Last 30 days',
        icon: 'pulse' as const,
      },
      {
        key: 'hydration',
        title: 'Hydration rhythm',
        meta: hydrationMeta,
        caption: insights ? `${insights.hydration_logs || 0} logs this month` : 'No recent logs',
        icon: 'water' as const,
      },
      {
        key: 'mood',
        title: 'Mood balance',
        meta: {
          label: insights?.stress_free_days ? `${insights.stress_free_days} days` : 'Track to unlock',
          color: '#FACC15',
          icon: 'sunny' as const,
        },
        caption: 'Keep logging your moods',
        icon: 'sunny' as const,
      },
      {
        key: 'consistency',
        title: 'Log consistency',
        meta: {
          label: entries.length ? `${entries.length} recent` : 'Build a streak',
          color: '#A855F7',
          icon: 'book' as const,
        },
        caption: 'Fresh entries boost accuracy',
        icon: 'book' as const,
      },
    ],
    [symptomMeta, hydrationMeta, insights, entries.length]
  );

  const renderTypeSelector = () => (
    <View style={styles.typeSelectorContainer}>
      {(Object.keys(entryTypeConfig) as EntryType[]).map((type) => {
        const config = entryTypeConfig[type];
        return (
          <TouchableOpacity
            key={type}
            style={[styles.typeOption, selectedType === type && { borderColor: config.color + '66', backgroundColor: config.color + '22' }]}
            onPress={() => setSelectedType(type)}
          >
            <Ionicons name={config.icon} size={20} color={config.color} />
            <Text style={[styles.typeLabel, selectedType === type && { color: '#F8FAFC' }]}>{config.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const recentEntries = entries.slice(0, 4);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#030712', '#0F172A']} style={styles.gradientBackground}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
          contentContainerStyle={styles.scrollContent}
        >
          <LinearGradient colors={['#0F172A', '#1D213A']} style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTextBlock}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroIconBadge}>
                    <Ionicons name="sparkles" size={18} color="#6366F1" />
                  </View>
                  <Text style={styles.heroLabel}>Daily snapshot</Text>
                </View>
                <Text style={styles.heroTitle}>
                  Welcome back{healthProfile?.first_name ? `, ${healthProfile.first_name}` : ''}
                </Text>
                {healthProfile?.health_persona ? (
                  <View style={styles.heroPersonaWrapper}>
                    <MarkdownText
                      content={healthProfile.health_persona}
                      variant="light"
                    />
                  </View>
                ) : (
                  <Text style={styles.heroSubtitle}>
                    A quick pulse on how your body is doing today.
                  </Text>
                )}
              </View>
              <View style={styles.heroScoreBlock}>
                <View style={[styles.scoreBadge, { borderColor: getHealthScoreColor(healthScore) + '55' }]}>
                  <Text style={styles.scoreValue}>{healthScore}</Text>
                  <Text style={styles.scoreLabel}>Health score</Text>
                  <View style={[styles.scoreChip, { backgroundColor: getHealthScoreColor(healthScore) + '22' }]}>
                    <Ionicons name="pulse" size={14} color={getHealthScoreColor(healthScore)} />
                    <Text style={[styles.scoreChipText, { color: getHealthScoreColor(healthScore) }]}>Live</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.heroMetricsRow}>
              <View style={styles.heroMetric}>
                <Text style={styles.metricLabel}>Stress-free days</Text>
                <Text style={styles.metricValue}>{insights?.stress_free_days ?? '—'}</Text>
                <Text style={styles.metricCaption}>Current streak</Text>
              </View>
              <View style={styles.heroMetric}>
                <Text style={styles.metricLabel}>Hydration logs</Text>
                <Text style={styles.metricValue}>{insights?.hydration_logs ?? '—'}</Text>
                <Text style={styles.metricCaption}>This month</Text>
              </View>
              <View style={styles.heroMetric}>
                <Text style={styles.metricLabel}>Entries</Text>
                <Text style={styles.metricValue}>{insights?.total_entries ?? '—'}</Text>
                <Text style={styles.metricCaption}>Last 30 days</Text>
              </View>
            </View>
          </LinearGradient>

          {insights?.ai_insights ? (
            <GlassCard style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={16} color="#6366F1" />
                </View>
                <Text style={styles.aiTitle}>AI sees this pattern</Text>
              </View>
              <MarkdownText content={insights.ai_insights} variant="light" />
            </GlassCard>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Focus areas</Text>
              <Text style={styles.sectionSubtitle}>Where to spend your energy today</Text>
            </View>
            <View style={styles.focusGrid}>
              {focusCards.map((card) => (
                <GlassCard key={card.key} style={styles.focusCard}>
                  <View style={[styles.focusIcon, { backgroundColor: card.meta.color + '1f' }]}>
                    <Ionicons name={card.icon} size={18} color={card.meta.color} />
                  </View>
                  <Text style={styles.focusTitle}>{card.title}</Text>
                  <Text style={[styles.focusValue, { color: card.meta.color }]}>{card.meta.label}</Text>
                  <Text style={styles.focusCaption}>{card.caption}</Text>
                </GlassCard>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active challenges</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/challenges')}>
                <Text style={styles.sectionLink}>View all</Text>
              </TouchableOpacity>
            </View>
            {activeChallenges.length === 0 ? (
              <GlassCard>
                <Text style={styles.emptyText}>Pick a challenge to start building momentum.</Text>
              </GlassCard>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.challengeScroll}>
                {activeChallenges.slice(0, 3).map((challenge) => {
                  const completion = challenge.completed_days / challenge.duration_days;
                  return (
                    <GlassCard key={challenge.id} gradient style={styles.challengeCard}>
                      <View style={styles.challengeTopRow}>
                        <View style={styles.challengeBadge}>
                          <Ionicons name="trophy" size={18} color="#F59E0B" />
                        </View>
                        <Text style={styles.challengePercent}>{Math.round(completion * 100)}%</Text>
                      </View>
                      <Text style={styles.challengeTitle}>{challenge.title}</Text>
                      <Text style={styles.challengeMeta}>
                        Day {challenge.completed_days} of {challenge.duration_days}
                      </Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressIndicator, { width: `${Math.max(8, completion * 100)}%` }]} />
                      </View>
                    </GlassCard>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick actions</Text>
              <Text style={styles.sectionSubtitle}>Jump back into your favourite tools</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScrollContent}>
              {quickActions.map((action) => (
                <View key={action.key} style={styles.actionCard}>
                  <QuickActionCard
                    icon={action.icon}
                    title={action.title}
                    subtitle={action.subtitle}
                    colors={action.colors}
                    onPress={() => router.push(action.route)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              <TouchableOpacity onPress={() => setModalVisible(true)}>
                <Text style={styles.sectionLink}>Log something new</Text>
              </TouchableOpacity>
            </View>
            {recentEntries.length === 0 ? (
              <GlassCard>
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color="#64748B" />
                  <Text style={styles.emptyText}>No entries yet</Text>
                  <Text style={styles.emptySubtext}>Start capturing how you feel and what you do</Text>
                </View>
              </GlassCard>
            ) : (
              <View style={styles.timelineContainer}>
                {recentEntries.map((item, index) => {
                  const config = entryTypeConfig[item.entry_type];
                  const isLast = index === recentEntries.length - 1;
                  return (
                    <View key={item.id} style={styles.timelineItem}>
                      <View style={styles.timelineMarker}>
                        <View style={[styles.timelineDot, { borderColor: config.color }]} />
                        {!isLast && <View style={styles.timelineConnector} />}
                      </View>
                      <GlassCard style={styles.timelineCard}>
                        <View style={styles.timelineHeader}>
                          <View style={[styles.timelineIcon, { backgroundColor: config.color + '22' }]}>
                            <Ionicons name={config.icon} size={18} color={config.color} />
                          </View>
                          <View style={styles.timelineTextWrapper}>
                            <Text style={styles.timelineTitle}>{item.title}</Text>
                            <Text style={styles.timelineMeta}>{format(new Date(item.timestamp), 'MMM d • h:mm a')}</Text>
                          </View>
                        </View>
                        {item.tags && item.tags.length > 0 && (
                          <View style={styles.timelineTagRow}>
                            {item.tags.map((tag) => {
                              const [rawKey, ...rest] = tag.split(':');
                              const key = rawKey || '';
                              const value = rest.join(':');
                              const labelKey = key
                                ? key.charAt(0).toUpperCase() + key.slice(1)
                                : '';
                              const label = value
                                ? `${labelKey}: ${value}`
                                : tag;
                              return (
                                <View key={tag} style={styles.timelineTagChip}>
                                  <Text style={styles.timelineTagText}>{label}</Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                        {item.description ? (
                          <MarkdownText content={item.description} variant="light" />
                        ) : null}
                        {item.severity !== undefined && (
                          <View style={styles.severityBadge}>
                            <Ionicons name="pulse" size={12} color={config.color} />
                            <Text style={[styles.severityText, { color: config.color }]}>Severity {item.severity}</Text>
                          </View>
                        )}
                      </GlassCard>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.fabGradient}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Entry</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              ref={scrollViewRef}
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              keyboardDismissMode="on-drag"
            >
              {renderTypeSelector()}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="What happened?"
                placeholderTextColor="#64748B"
                value={title}
                onChangeText={setTitle}
                editable={!isSaving}
                returnKeyType="done"
                blurOnSubmit={true}
              />
            </View>

            {selectedType === 'mood' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>How are you feeling?</Text>
                <View style={styles.chipRow}>
                  {['Joyful', 'Calm', 'Content', 'Energetic', 'Motivated', 'Relaxed'].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.chip,
                        moodCategory === m && styles.chipSelected,
                      ]}
                      onPress={() => setMoodCategory(m)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          moodCategory === m && styles.chipTextSelected,
                        ]}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.chipRow}>
                  {['Stressed', 'Anxious', 'Tired', 'Sad', 'Irritable', 'Overwhelmed'].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.chip,
                        moodCategory === m && styles.chipSelected,
                      ]}
                      onPress={() => setMoodCategory(m)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          moodCategory === m && styles.chipTextSelected,
                        ]}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Intensity</Text>
                <View style={styles.chipRowSecondary}>
                  {[
                    { key: 'low', label: 'Mild' },
                    { key: 'medium', label: 'Moderate' },
                    { key: 'high', label: 'Strong' },
                  ].map((i) => (
                    <TouchableOpacity
                      key={i.key}
                      style={[
                        styles.chipSmall,
                        moodIntensity === i.key && styles.chipSelected,
                      ]}
                      onPress={() => setMoodIntensity(i.key as typeof moodIntensity)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          moodIntensity === i.key && styles.chipTextSelected,
                        ]}
                      >
                        {i.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {selectedType === 'medicine' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Medicine name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Paracetamol 500mg"
                  placeholderTextColor="#64748B"
                  value={medicineName}
                  onChangeText={setMedicineName}
                  editable={!isSaving}
                  returnKeyType="done"
                  blurOnSubmit={true}
                />
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Time Taken</Text>
                <View style={styles.chipRow}>
                  {[
                    { key: 'morning', label: 'Morning (6-10 AM)' },
                    { key: 'afternoon', label: 'Afternoon (12-4 PM)' },
                    { key: 'evening', label: 'Evening (6-9 PM)' },
                    { key: 'night', label: 'Night (9 PM+)' },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      style={[
                        styles.chipSmall,
                        medicineTime === t.key && styles.chipSelected,
                      ]}
                      onPress={() => setMedicineTime(t.key as typeof medicineTime)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          medicineTime === t.key && styles.chipTextSelected,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {selectedType === 'sleep' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Hours of Sleep</Text>
                <View style={styles.chipRow}>
                  {['<4', '4-5', '5-6', '6-7', '7-8', '8-9', '9+'].map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.chipSmall,
                        sleepHours === h && styles.chipSelected,
                      ]}
                      onPress={() => setSleepHours(h)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          sleepHours === h && styles.chipTextSelected,
                        ]}
                      >
                        {h}h
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Sleep Quality</Text>
                <View style={styles.chipRowSecondary}>
                  {[
                    { key: 'excellent', label: 'Excellent' },
                    { key: 'great', label: 'Good' },
                    { key: 'ok', label: 'Fair' },
                    { key: 'restless', label: 'Restless' },
                    { key: 'poor', label: 'Poor' },
                  ].map((q) => (
                    <TouchableOpacity
                      key={q.key}
                      style={[
                        styles.chipSmall,
                        sleepQuality === q.key && styles.chipSelected,
                      ]}
                      onPress={() => setSleepQuality(q.key as typeof sleepQuality)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          sleepQuality === q.key && styles.chipTextSelected,
                        ]}
                      >
                        {q.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {selectedType === 'hydration' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Water Intake (Glasses ~250ml)</Text>
                <View style={styles.chipRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.chipSmall,
                        hydrationCups === c && styles.chipSelected,
                      ]}
                      onPress={() => setHydrationCups(c)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          hydrationCups === c && styles.chipTextSelected,
                        ]}
                      >
                        {c} glasses
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.chipRow}>
                  {[9, 10, 11, 12].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.chipSmall,
                        hydrationCups === c && styles.chipSelected,
                      ]}
                      onPress={() => setHydrationCups(c)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          hydrationCups === c && styles.chipTextSelected,
                        ]}
                      >
                        {c} glasses
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {selectedType === 'exercise' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Activity Type</Text>
                <View style={styles.chipRow}>
                  {['Running', 'Walking', 'Cycling', 'Swimming', 'Yoga', 'Gym'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        exerciseType === type && styles.chipSelected,
                      ]}
                      onPress={() => setExerciseType(type)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          exerciseType === type && styles.chipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.chipRow}>
                  {['Sports', 'Dancing', 'Hiking', 'Stretching', 'Martial Arts', 'Other'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        exerciseType === type && styles.chipSelected,
                      ]}
                      onPress={() => setExerciseType(type)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          exerciseType === type && styles.chipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Duration</Text>
                <View style={styles.chipRow}>
                  {['15min', '30min', '45min', '1hr', '1.5hrs', '2hrs+'].map((dur) => (
                    <TouchableOpacity
                      key={dur}
                      style={[
                        styles.chipSmall,
                        exerciseDuration === dur && styles.chipSelected,
                      ]}
                      onPress={() => setExerciseDuration(dur)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          exerciseDuration === dur && styles.chipTextSelected,
                        ]}
                      >
                        {dur}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Intensity</Text>
                <View style={styles.chipRowSecondary}>
                  {[
                    { key: 'light', label: 'Light' },
                    { key: 'moderate', label: 'Moderate' },
                    { key: 'vigorous', label: 'Vigorous' },
                  ].map((i) => (
                    <TouchableOpacity
                      key={i.key}
                      style={[
                        styles.chipSmall,
                        exerciseIntensity === i.key && styles.chipSelected,
                      ]}
                      onPress={() => setExerciseIntensity(i.key as typeof exerciseIntensity)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          exerciseIntensity === i.key && styles.chipTextSelected,
                        ]}
                      >
                        {i.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {selectedType === 'symptom' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Body Part / Location</Text>
                <View style={styles.chipRow}>
                  {['Head', 'Throat', 'Chest', 'Stomach', 'Abdomen', 'Back'].map((loc) => (
                    <TouchableOpacity
                      key={loc}
                      style={[
                        styles.chip,
                        symptomLocation === loc && styles.chipSelected,
                      ]}
                      onPress={() => setSymptomLocation(loc)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          symptomLocation === loc && styles.chipTextSelected,
                        ]}
                      >
                        {loc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.chipRow}>
                  {['Arms', 'Legs', 'Joints', 'Muscles', 'Skin', 'Other'].map((loc) => (
                    <TouchableOpacity
                      key={loc}
                      style={[
                        styles.chip,
                        symptomLocation === loc && styles.chipSelected,
                      ]}
                      onPress={() => setSymptomLocation(loc)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          symptomLocation === loc && styles.chipTextSelected,
                        ]}
                      >
                        {loc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add more details..."
                placeholderTextColor="#64748B"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSaving}
              />
            </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={handleAddEntry}
              disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save Entry</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#030712',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientBackground: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
  },
  heroLabel: {
    color: 'rgba(226, 232, 240, 0.7)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: '#F9FAFB',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 10,
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    color: 'rgba(226, 232, 240, 0.86)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  heroPersonaWrapper: {
    marginTop: 10,
  },
  heroScoreBlock: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  scoreBadge: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: 'flex-end',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scoreLabel: {
    fontSize: 13,
    color: 'rgba(226, 232, 240, 0.8)',
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
  },
  scoreChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroMetricsRow: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 16,
  },
  heroMetric: {
    flex: 1,
  },
  metricLabel: {
    color: 'rgba(226, 232, 240, 0.7)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
  },
  metricCaption: {
    color: 'rgba(226, 232, 240, 0.6)',
    fontSize: 13,
    marginTop: 4,
  },
  aiCard: {
    marginBottom: 28,
    borderRadius: 20,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  aiBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  aiBody: {
    color: '#CBD5F5',
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  focusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  focusCard: {
    flexBasis: '47%',
    borderRadius: 20,
    gap: 12,
  },
  focusIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  focusValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  focusCaption: {
    fontSize: 12,
    color: '#94A3B8',
  },
  challengeScroll: {
    gap: 16,
  },
  challengeCard: {
    width: 240,
    borderRadius: 20,
    paddingVertical: 20,
    gap: 12,
  },
  challengeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeBadge: {
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengePercent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  challengeMeta: {
    fontSize: 13,
    color: '#CBD5F5',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressIndicator: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 999,
  },
  actionsScrollContent: {
    gap: 16,
    paddingRight: 6,
  },
  actionCard: {
    width: 200,
  },
  timelineContainer: {
    gap: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
  },
  timelineMarker: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: '#0F172A',
  },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: '#1E293B',
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTextWrapper: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  timelineMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  timelineBody: {
    fontSize: 14,
    color: '#CBD5F5',
    lineHeight: 20,
  },
  severityBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  timelineTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  timelineTagText: {
    fontSize: 11,
    color: '#CBD5F5',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99, 102, 241, 0.2)',
  },
  modalScrollView: {
    flexGrow: 1,
    flexShrink: 1,
    marginBottom: 16,
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  typeSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
    paddingHorizontal: 2,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  typeLabel: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: '#A5B4FC',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 18,
    color: '#F8FAFC',
    fontSize: 16,
    borderWidth: 2,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#6366F1',
    borderRadius: 18,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  chipRowSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  chipSmall: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  chipSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderWidth: 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  chipText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
});
