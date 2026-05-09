// src/components/CustomAlert.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppIcon, IconSize } from './icons';

type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export const CustomAlert = ({
  visible,
  title,
  message,
  variant = 'info',
  onClose,
  onConfirm,
  confirmText = 'OK',
}: {
  visible: boolean;
  title: string;
  message: string;
  variant?: AlertVariant;
  onClose?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'success': return <AppIcon.Success size={IconSize.xxl} />;
      case 'warning': return <AppIcon.Warning size={IconSize.xxl} />;
      case 'error': return <AppIcon.Error size={IconSize.xxl} />;
      default: return <AppIcon.Info size={IconSize.xxl} />;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {getIcon()}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onConfirm || onClose}>
            <Text style={styles.buttonText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#1f2937', padding: 24, borderRadius: 16, alignItems: 'center', width: '80%', maxWidth: 320 },
  title: { color: '#f9fafb', fontSize: 18, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  message: { color: '#9ca3af', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  button: { marginTop: 20, backgroundColor: '#22d3ee', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#0f172a', fontWeight: '600', fontSize: 16 }
});