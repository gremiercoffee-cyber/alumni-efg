import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLOR_PALETTE } from '../constants';

interface Props {
  visible: boolean;
  selectedColor?: string | null;
  onSelectColor: (color: string) => void;
  onCancel: () => void;
}

export default function ColorPickerModal({
  visible,
  selectedColor,
  onSelectColor,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.box} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Choose a color</Text>
          <View style={styles.grid}>
            {COLOR_PALETTE.map(color => {
              const selected = selectedColor?.toLowerCase() === color.toLowerCase();
              return (
                <TouchableOpacity
                  key={color}
                  onPress={() => onSelectColor(color)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: color,
                      borderWidth: selected ? 3 : 0,
                    },
                  ]}
                  activeOpacity={0.82}
                >
                  {selected ? <View style={styles.innerRing} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={onCancel} style={styles.cancel} activeOpacity={0.82}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    backgroundColor: '#f6f1e3',
    borderRadius: 16,
    padding: 24,
    width: '80%',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3a2e1f',
    marginBottom: 20,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderColor: '#3a2e1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#f6f1e3',
  },
  cancel: {
    marginTop: 20,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: '#8a7d63',
  },
});
