import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';

type OptionType = {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export default function Questions() {
  const { token } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [sleepPattern, setSleepPattern] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [hydrationLevel, setHydrationLevel] = useState('');
  const [stressLevel, setStressLevel] = useState('');
  const [exerciseFrequency, setExerciseFrequency] = useState('');
  const [dietType, setDietType] = useState('');

  const totalSteps = 6;

  const sleepPatternOptions: OptionType[] = [
    { value: 'early_bird', label: 'Early Bird', icon: 'sunny' },
    { value: 'night_owl', label: 'Night Owl', icon: 'moon' },
    { value: 'irregular', label: 'Irregular', icon: 'shuffle' },
  ];

  const sleepHoursOptions: OptionType[] = [
    { value: '4', label: '4-5 hours', icon: 'time' },
    { value: '6', label: '6-7 hours', icon: 'time' },
    { value: '8', label: '8+ hours', icon: 'time' },
  ];

  const hydrationOptions: OptionType[] = [
    { value: 'poor', label: 'Poor', icon: 'water' },
    { value: 'moderate', label: 'Moderate', icon: 'water' },
    { value: 'good', label: 'Good', icon: 'water' },
  ];

  const stressOptions: OptionType[] = [
    { value: 'low', label: 'Low', icon: 'happy' },
    { value: 'moderate', label: 'Moderate', icon: 'remove-circle' },
    { value: 'high', label: 'High', icon: 'sad' },
  ];

  const exerciseOptions: OptionType[] = [
    { value: 'never', label: 'Never', icon: 'close-circle' },
    { value: 'occasional', label: 'Occasional', icon: 'walk' },
    { value: 'regular', label: 'Regular', icon: 'bicycle' },
    { value: 'daily', label: 'Daily', icon: 'fitness' },
  ];

  const dietOptions: OptionType[] = [
    { value: 'balanced', label: 'Balanced', icon: 'restaurant' },
    { value: 'vegetarian', label: 'Vegetarian', icon: 'leaf' },
    { value: 'vegan', label: 'Vegan', icon: 'nutrition' },
    { value: 'fast_food', label: 'Fast Food', icon: 'fast-food' },
  ];

  const handleSubmit = async () => {
    if (!sleepPattern || !sleepHours || !hydrationLevel || !stressLevel || !exerciseFrequency || !dietType) {
      Alert.alert('Error', 'Please answer all questions');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/health/profile`,
        {
          sleep_pattern: sleepPattern,
          sleep_hours: parseInt(sleepHours),
          hydration_level: hydrationLevel,
          stress_level: stressLevel,
          exercise_frequency: exerciseFrequency,
          diet_type: dietType,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      Alert.alert('Success', 'Your health profile has been created!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/home') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  const renderOptions = (options: OptionType[], selectedValue: string, onSelect: (value: string) => void) => (
    <View style={styles.optionsContainer}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.option,
            selectedValue === option.value && styles.optionSelected,
          ]}
          onPress={() => onSelect(option.value)}
        >
          <Ionicons
            name={option.icon}
            size={32}
            color={selectedValue === option.value ? '#6366F1' : '#94A3B8'}
          />
          <Text
            style={[
              styles.optionText,
              selectedValue === option.value && styles.optionTextSelected,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>What's your sleep pattern?</Text>
            {renderOptions(sleepPatternOptions, sleepPattern, setSleepPattern)}
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>How many hours do you sleep?</Text>
            {renderOptions(sleepHoursOptions, sleepHours, setSleepHours)}
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>How's your hydration level?</Text>
            {renderOptions(hydrationOptions, hydrationLevel, setHydrationLevel)}
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>What's your stress level?</Text>
            {renderOptions(stressOptions, stressLevel, setStressLevel)}
          </View>
        );
      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>How often do you exercise?</Text>
            {renderOptions(exerciseOptions, exerciseFrequency, setExerciseFrequency)}
          </View>
        );
      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>What's your diet type?</Text>
            {renderOptions(dietOptions, dietType, setDietType)}
          </View>
        );
      default:
        return null;
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return sleepPattern !== '';
      case 2:
        return sleepHours !== '';
      case 3:
        return hydrationLevel !== '';
      case 4:
        return stressLevel !== '';
      case 5:
        return exerciseFrequency !== '';
      case 6:
        return dietType !== '';
      default:
        return false;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Health Profile</Text>
        <Text style={styles.subtitle}>
          Step {currentStep} of {totalSteps}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentStep(currentStep - 1)}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={24} color="#94A3B8" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }} />

        {currentStep < totalSteps ? (
          <TouchableOpacity
            style={[styles.nextButton, !canGoNext() && styles.buttonDisabled]}
            onPress={() => setCurrentStep(currentStep + 1)}
            disabled={!canGoNext()}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextButton, (!canGoNext() || isLoading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canGoNext() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>Finish</Text>
                <Ionicons name="checkmark" size={24} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#1E293B',
    marginHorizontal: 24,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  stepContainer: {
    flex: 1,
  },
  question: {
    fontSize: 24,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 32,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  optionSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#1E2947',
  },
  optionText: {
    marginLeft: 16,
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#F1F5F9',
  },
  footer: {
    flexDirection: 'row',
    padding: 24,
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  nextButtonText: {
    marginRight: 8,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
