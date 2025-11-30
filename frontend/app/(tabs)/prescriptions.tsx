import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { uploadPrescription, getPrescriptionHistory, PrescriptionAnalysis } from '@/utils/api';
import { GlassCard } from '@/components/GlassCard';
import { MarkdownText } from '@/components/MarkdownText';

// Theme colors
const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  textSecondary: '#94A3B8',
  primary: '#6366F1',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

export default function PrescriptionsScreen() {
  const { token } = useAuth();
  const [prescriptions, setPrescriptions] = useState<PrescriptionAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionAnalysis | null>(null);

  useEffect(() => {
    loadPrescriptions();
  }, []);

  const loadPrescriptions = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const data = await getPrescriptionHistory(token);
      setPrescriptions(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load prescriptions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPrescriptions();
    setRefreshing(false);
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Camera permission is needed to take photos');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Photo library permission is needed');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        await handleUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleUpload = async (imageUri: string) => {
    if (!token) return;

    try {
      setUploading(true);
      const analysis = await uploadPrescription(token, imageUri);
      setUploading(false);
      // Reload the list in the background
      loadPrescriptions().catch(console.error);
      // Show the analysis immediately
      setSelectedPrescription(analysis);
    } catch (error: any) {
      setUploading(false);
      Alert.alert('Error', error.message || 'Failed to upload prescription');
      console.error(error);
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      'Upload Prescription',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Choose from Library',
          onPress: () => pickImage('library'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const renderPrescriptionCard = (prescription: PrescriptionAnalysis) => (
    <TouchableOpacity
      key={prescription.id}
      onPress={() => setSelectedPrescription(prescription)}
      style={styles.prescriptionCard}
    >
      <GlassCard style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Ionicons name="medical" size={24} color={colors.primary} />
          <View style={styles.cardHeaderText}>
            <Text style={styles.medicationName}>{prescription.medication_name}</Text>
            <Text style={styles.date}>
              {new Date(prescription.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </View>
        
        {prescription.frequency && (
          <View style={styles.quickInfo}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.quickInfoText}>{prescription.frequency}</Text>
          </View>
        )}
        
        {prescription.timing && (
          <View style={styles.quickInfo}>
            <Ionicons name="alarm-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.quickInfoText}>{prescription.timing}</Text>
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );

  const renderPrescriptionDetail = () => {
    if (!selectedPrescription) return null;

    return (
      <ScrollView 
        style={styles.detailContainer}
        contentContainerStyle={styles.detailContent}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedPrescription(null)}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <GlassCard style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedPrescription.medication_name}</Text>
          
          {selectedPrescription.dosage && (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Ionicons name="fitness" size={20} color={colors.primary} />
                <Text style={styles.detailSectionTitle}>Dosage</Text>
              </View>
              <Text style={styles.detailText}>{selectedPrescription.dosage}</Text>
            </View>
          )}

          {selectedPrescription.frequency && (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Ionicons name="time" size={20} color={colors.primary} />
                <Text style={styles.detailSectionTitle}>Frequency</Text>
              </View>
              <Text style={styles.detailText}>{selectedPrescription.frequency}</Text>
            </View>
          )}

          {selectedPrescription.timing && (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Ionicons name="alarm" size={20} color={colors.primary} />
                <Text style={styles.detailSectionTitle}>Best Time to Take</Text>
              </View>
              <Text style={styles.detailText}>{selectedPrescription.timing}</Text>
            </View>
          )}

          {selectedPrescription.purpose && (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Ionicons name="information-circle" size={20} color={colors.primary} />
                <Text style={styles.detailSectionTitle}>Purpose</Text>
              </View>
              <Text style={styles.detailText}>{selectedPrescription.purpose}</Text>
            </View>
          )}

          {selectedPrescription.side_effects && (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Ionicons name="warning" size={20} color={colors.warning} />
                <Text style={styles.detailSectionTitle}>Possible Side Effects</Text>
              </View>
              <Text style={styles.detailText}>{selectedPrescription.side_effects}</Text>
            </View>
          )}

          {selectedPrescription.interactions && (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.detailSectionTitle}>Interactions & Warnings</Text>
              </View>
              <Text style={styles.detailText}>{selectedPrescription.interactions}</Text>
            </View>
          )}

          {selectedPrescription.personalized_advice && (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Ionicons name="person" size={20} color={colors.success} />
                <Text style={styles.detailSectionTitle}>Personalized Advice</Text>
              </View>
              <MarkdownText content={selectedPrescription.personalized_advice} />
            </View>
          )}

          <View style={styles.detailSection}>
            <View style={styles.detailSectionHeader}>
              <Ionicons name="document-text" size={20} color={colors.textSecondary} />
              <Text style={styles.detailSectionTitle}>Extracted Text</Text>
            </View>
            <Text style={styles.extractedText}>{selectedPrescription.extracted_text}</Text>
          </View>
        </GlassCard>
      </ScrollView>
    );
  };

  if (uploading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Analyzing prescription...</Text>
          <Text style={styles.loadingSubtext}>This may take a moment</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedPrescription) {
    return (
      <SafeAreaView style={styles.container}>
        {renderPrescriptionDetail()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Prescriptions</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={showUploadOptions}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : prescriptions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="medical-outline" size={80} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Prescriptions Yet</Text>
          <Text style={styles.emptyText}>
            Upload a photo of your prescription to get AI-powered analysis
          </Text>
          <TouchableOpacity style={styles.uploadButtonLarge} onPress={showUploadOptions}>
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.uploadButtonText}>Upload Prescription</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.infoCard}>
            <GlassCard style={styles.infoCardContent}>
              <Ionicons name="information-circle" size={24} color={colors.primary} />
              <Text style={styles.infoText}>
                Upload prescription photos to get personalized medication guidance based on your health profile
              </Text>
            </GlassCard>
          </View>

          <View style={styles.prescriptionsList}>
            {prescriptions.map(renderPrescriptionCard)}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  uploadButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  detailContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  uploadButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoCard: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  infoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  prescriptionsList: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  prescriptionCard: {
    marginBottom: 12,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  date: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  quickInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailContainer: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    marginHorizontal: 20,
    marginTop: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  detailCard: {
    padding: 20,
    marginHorizontal: 20,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  detailText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  extractedText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

