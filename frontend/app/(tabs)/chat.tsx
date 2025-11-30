import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { MarkdownText } from '../../components/MarkdownText';
import { colors, spacing } from '../../constants/theme';

const BACKEND_URL = API_BASE_URL;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface PrescriptionItem {
  id: string;
  medication_name: string;
  dosage?: string | null;
  frequency?: string | null;
  timing?: string | null;
  created_at: string;
}

export default function Chat() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);

  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages load or update
    if (messages.length > 0 && !isLoading) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length, isLoading]);

  const loadChatHistory = async () => {
    try {
  const response = await axios.get(`${BACKEND_URL}/api/chat/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessages(response.data.messages);
      // Also fetch recent prescriptions to provide quick reference buttons
      try {
        const presRes = await axios.get(`${BACKEND_URL}/api/prescriptions/history?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const items: PrescriptionItem[] = (presRes.data || []).map((p: any) => ({
          id: String(p.id),
          medication_name: String(p.medication_name || 'Unknown'),
          dosage: p.dosage ?? null,
          frequency: p.frequency ?? null,
          timing: p.timing ?? null,
          created_at: p.created_at,
        }));
        setPrescriptions(items);
      } catch (e) {
        // Non-fatal
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    const userMessage = inputText.trim();
    setInputText('');

    // Add user message optimistically
    const tempUserMsg: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    setIsSending(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/chat/message`,
        { message: userMessage },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessages((prev) => [...prev, response.data]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Add error message
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.role === 'user';
    const showAvatar = index === 0 || messages[index - 1].role !== item.role;

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessageContainer : styles.aiMessageContainer]}>
        {showAvatar && !isUser && (
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            style={styles.aiAvatar}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          </LinearGradient>
        )}
        {!showAvatar && !isUser && <View style={styles.avatarSpacer} />}
        
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {isUser ? (
            <Text style={styles.userText}>{item.content}</Text>
          ) : (
            <MarkdownText content={item.content} variant="dark" />
          )}
        </View>
        
        {showAvatar && isUser && (
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={18} color="#FFFFFF" />
          </View>
        )}
        {!showAvatar && isUser && <View style={styles.avatarSpacer} />}
      </View>
    );
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient
        colors={colors.backgroundGradient}
        style={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={24} color={colors.accentPrimary} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Health AI</Text>
            <Text style={styles.headerSubtitle}>Your personal health assistant</Text>
          </View>
        </View>

        {prescriptions.length > 0 && (
          <View style={styles.prescriptionsBar}>
            <Text style={styles.prescriptionsLabel}>Your prescriptions:</Text>
            <FlatList
              horizontal
              data={prescriptions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.prescriptionsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.prescriptionChip}
                  onPress={() => setInputText(prev => prev ? `${prev} \n\nPlease reference my prescription: ${item.medication_name}` : `Please reference my prescription: ${item.medication_name}`)}
                >
                  <Ionicons name="medkit" size={14} color="#FDE68A" />
                  <Text style={styles.prescriptionChipText} numberOfLines={1}>
                    {item.medication_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.chatWrapper}>
            {messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#475569" />
                <Text style={styles.emptyText}>Start a conversation</Text>
                <Text style={styles.emptySubtext}>Ask me anything about your health!</Text>
                <View style={styles.examplesContainer}>
                  <TouchableOpacity
                    style={styles.exampleCard}
                    onPress={() => setInputText('What can you tell me about my health profile?')}
                  >
                    <Text style={styles.exampleText}>What can you tell me about my health profile?</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.exampleCard}
                    onPress={() => setInputText('Give me tips to improve my sleep')}
                  >
                    <Text style={styles.exampleText}>Give me tips to improve my sleep</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(_, index) => index.toString()}
                contentContainerStyle={styles.chatContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>

          <View style={styles.inputOuter}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask about your health..."
                placeholderTextColor="#64748B"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!isSending}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030712',
  },
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatWrapper: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 18,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
    marginBottom: 32,
  },
  examplesContainer: {
    width: '100%',
    gap: 12,
  },
  exampleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exampleText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatarSpacer: {
    width: 36,
    marginHorizontal: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  inputOuter: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 88,
    backgroundColor: colors.backgroundGradient[0],
  },
  prescriptionsBar: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  prescriptionsLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
  },
  prescriptionsList: {
    gap: 8,
  },
  prescriptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
    maxWidth: 220,
  },
  prescriptionChipText: {
    color: '#FDE68A',
    fontSize: 12,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 18,
    paddingHorizontal: 0,
    paddingVertical: 6,
    color: '#F1F5F9',
    fontSize: 15,
    maxHeight: 120,
    marginRight: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
