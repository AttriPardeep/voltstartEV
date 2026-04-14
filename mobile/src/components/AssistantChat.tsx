// src/components/AssistantChat.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { api } from '../utils/api';
import { useChargerStore } from '../store/chargerStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  action?: any;
  timestamp: Date;
}

interface Props {
  onAction: (action: any) => void;
}

export default function AssistantChat({ onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: "Hi! I'm Volt ⚡ Ask me to find chargers, check your session, or anything about charging.",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const { chargers, userLocation } = useChargerStore();

  const toggleChat = () => {
    const toValue = open ? 0 : 1;
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    setOpen(!open);
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await api.post('/api/assistant/query', {
        message: text,
        nearbyChargers: chargers.slice(0, 8),
        userLocation,
      });

      const { response, action } = res.data.data;

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response,
        action,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (action) {
        onAction(action);
      }

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: "Sorry, I'm having trouble connecting right now. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading, chargers, userLocation]);

  const chatTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  const QUICK_QUERIES = [
    'Nearest charger',
    'My session status',
    'This month stats',
    'Fast chargers only',
  ];

  return (
    <>
      {/* Floating button */}
      <TouchableOpacity style={s.fab} onPress={toggleChat}
        activeOpacity={0.85}>
        <Text style={s.fabText}>{open ? '✕' : '⚡'}</Text>
        {!open && <Text style={s.fabLabel}>Volt AI</Text>}
      </TouchableOpacity>

      {/* Chat panel */}
      {open && (
        <Animated.View style={[s.panel,
          { transform: [{ translateY: chatTranslateY }] }]}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.onlineDot} />
              <Text style={s.headerTitle}>Volt Assistant</Text>
            </View>
            <TouchableOpacity onPress={toggleChat}>
              <Text style={s.headerClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView ref={scrollRef} style={s.messages}
            contentContainerStyle={s.messagesContent}
            showsVerticalScrollIndicator={false}>
            {messages.map(msg => (
              <View key={msg.id}
                style={[s.bubble,
                  msg.role === 'user' ? s.userBubble : s.assistantBubble]}>
                <Text style={[s.bubbleText,
                  msg.role === 'user' ? s.userText : s.assistantText]}>
                  {msg.text}
                </Text>
                {msg.action && (
                  <View style={s.actionPill}>
                    <Text style={s.actionPillText}>
                      {getActionLabel(msg.action)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
            {loading && (
              <View style={s.assistantBubble}>
                <ActivityIndicator size="small" color="#22d3ee" />
              </View>
            )}
          </ScrollView>

          {/* Quick queries */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={s.quickScroll} contentContainerStyle={s.quickContent}>
            {QUICK_QUERIES.map(q => (
              <TouchableOpacity key={q} style={s.quickChip}
                onPress={() => { setInput(q); }}>
                <Text style={s.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask Volt anything..."
                placeholderTextColor="#475569"
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                multiline={false}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDim]}
                onPress={sendMessage}
                disabled={!input.trim() || loading}>
                <Text style={s.sendBtnText}>→</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      )}
    </>
  );
}

function getActionLabel(action: any): string {
  switch (action.type) {
    case 'navigate': return `📍 Navigating to ${action.chargeBoxId}`;
    case 'filter': return '🔍 Filters applied';
    case 'navigate_tab': return `📱 Opening ${action.tab}`;
    case 'start_charging': return `⚡ Starting charge...`;
    case 'stop_charging': return `⏹ Stopping charge...`;
    default: return '✓ Action taken';
  }
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 90, right: 16,
    backgroundColor: '#ec4899', borderRadius: 28,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: '#ec4899', shadowOpacity: 0.4,
    shadowRadius: 12, elevation: 8,
    zIndex: 100,
  },
  fabText: { fontSize: 18, color: '#0f172a' },
  fabLabel: { color: '#0f172a', fontWeight: '800', fontSize: 13 },
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1e293b', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, height: 480,
    shadowColor: '#000', shadowOpacity: 0.5,
    shadowRadius: 20, elevation: 20,
    zIndex: 99,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineDot: { width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#22c55e' },
  headerTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  headerClose: { color: '#64748b', fontSize: 20, padding: 4 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 10 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  userBubble: { backgroundColor: '#22d3ee', alignSelf: 'flex-end',
    borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#0f172a', alignSelf: 'flex-start',
    borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#0f172a', fontWeight: '600' },
  assistantText: { color: '#e2e8f0' },
  actionPill: { backgroundColor: '#0c4a6e', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 6,
    alignSelf: 'flex-start' },
  actionPillText: { color: '#22d3ee', fontSize: 11, fontWeight: '600' },
  quickScroll: { maxHeight: 44, borderTopWidth: 1,
    borderTopColor: '#334155' },
  quickContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickChip: { backgroundColor: '#0f172a', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#334155' },
  quickChipText: { color: '#94a3b8', fontSize: 12 },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8,
    borderTopWidth: 1, borderTopColor: '#334155' },
  input: { flex: 1, backgroundColor: '#0f172a', color: '#fff',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  sendBtn: { backgroundColor: '#22d3ee', borderRadius: 20,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendBtnDim: { backgroundColor: '#334155' },
  sendBtnText: { color: '#0f172a', fontSize: 20, fontWeight: '800' },
});