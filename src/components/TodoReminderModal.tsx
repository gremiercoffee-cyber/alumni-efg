import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS } from '../constants';
import { formatReminderLabel } from '../utils';

interface Props {
  visible: boolean;
  itemText: string;
  initialTimestamp: number;
  suggestedLabel?: string | null;
  onSkip: () => void;
  onSave: (timestamp: number) => void;
}

export default function TodoReminderModal({
  visible,
  itemText,
  initialTimestamp,
  suggestedLabel,
  onSkip,
  onSave,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(() => new Date(initialTimestamp));
  const [showIosPicker, setShowIosPicker] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setSelectedDate(new Date(initialTimestamp));
    }
  }, [initialTimestamp, visible]);

  const formatted = useMemo(
    () => formatReminderLabel(selectedDate.getTime()) || '',
    [selectedDate]
  );

  const openAndroidPicker = (mode: 'date' | 'time') => {
    DateTimePickerAndroid.open({
      value: selectedDate,
      mode,
      is24Hour: false,
      onChange: (_, nextDate) => {
        if (!nextDate) return;
        setSelectedDate(current => {
          const merged = new Date(current);
          if (mode === 'date') {
            merged.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
          } else {
            merged.setHours(nextDate.getHours(), nextDate.getMinutes(), 0, 0);
          }
          return merged;
        });
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>Reminder</Text>
          <Text style={styles.title}>When should we remind you?</Text>
          <Text style={styles.itemText}>{itemText}</Text>
          {suggestedLabel ? (
            <Text style={styles.suggested}>Suggested from context: {suggestedLabel}</Text>
          ) : null}

          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Scheduled for</Text>
            <Text style={styles.previewValue}>{formatted}</Text>
          </View>

          {Platform.OS === 'ios' ? (
            <>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setShowIosPicker(value => !value)}
                activeOpacity={0.8}
              >
                <Text style={styles.editButtonText}>
                  {showIosPicker ? 'Hide picker' : 'Pick date and time'}
                </Text>
              </TouchableOpacity>
              {showIosPicker ? (
                <DateTimePicker
                  value={selectedDate}
                  mode="datetime"
                  onChange={(_, nextDate) => nextDate && setSelectedDate(nextDate)}
                />
              ) : null}
            </>
          ) : (
            <View style={styles.androidButtons}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openAndroidPicker('date')}
                activeOpacity={0.8}
              >
                <Text style={styles.editButtonText}>Choose date</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openAndroidPicker('time')}
                activeOpacity={0.8}
              >
                <Text style={styles.editButtonText}>Choose time</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondary} onPress={onSkip} activeOpacity={0.8}>
              <Text style={styles.secondaryText}>Skip for now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primary}
              onPress={() => onSave(selectedDate.getTime())}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryText}>Save reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 18,
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  eyebrow: {
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    color: COLORS.brownLight,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.brown,
  },
  itemText: {
    fontSize: FONTS.size.base,
    color: COLORS.brownMid,
    lineHeight: 21,
  },
  suggested: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownLight,
  },
  preview: {
    backgroundColor: COLORS.white60,
    borderRadius: 12,
    padding: 14,
  },
  previewLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  previewValue: {
    fontSize: FONTS.size.lg,
    color: COLORS.brown,
    fontWeight: '600',
    marginTop: 4,
  },
  androidButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 28,
    paddingVertical: 14,
  },
  secondaryText: {
    fontSize: FONTS.size.md,
    color: COLORS.brownLight,
  },
  primary: {
    flex: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brown,
    borderRadius: 28,
    paddingVertical: 14,
  },
  primaryText: {
    fontSize: FONTS.size.md,
    color: COLORS.bg,
    fontWeight: '700',
  },
});
