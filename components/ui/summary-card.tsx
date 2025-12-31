import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as C from '@/constants/colors';

interface Props {
  title: string;
  amount: number;
  subtitle?: string;
  onPress?: () => void;
  color?: string;
}

export default function SummaryCard({ title, amount, subtitle, onPress, color }: Props) {
  const display = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(amount);
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: color || C.PRIMARY_PURPLE }]}> 
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.amount}>{display}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    margin: 6,
    minWidth: 177,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    color: '#F6F3FF',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  amount: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  subtitle: {
    color: '#EDE8FF',
    marginTop: 6,
    fontSize: 12,
  },
});

