import * as C from '@/constants/colors';
import { Debt } from '@/types/models';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  debt: Debt;
  onRemind?: (d: Debt) => void;
  onSettle?: (d: Debt) => void;
};

export default function DebtCard({ debt, onRemind, onSettle }: Props) {
  const originalAmount = debt.amount;
  const remainingAmount = debt.remainingAmount ?? debt.amount;
  const amountLabel = `${debt.currency ?? 'XAF'} ${Number(originalAmount).toFixed(2)}`;
  const remainingLabel = `${debt.currency ?? 'XAF'} ${Number(remainingAmount).toFixed(2)}`;
  const subtitle = debt.dueDate ? `Due ${new Date(debt.dueDate).toLocaleDateString()}` : 'No due date';
  const statusColor = 
    debt.status === 'paid' ? '#10B981' : 
    debt.status === 'partial' ? '#F59E0B' : 
    '#EF4444';
  const isPaid = (debt.status === 'paid') || (Number(remainingAmount) <= 0);

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{debt.direction === 'owed' ? 'They owe you' : 'You owe'}</Text>
          {debt.status && (
            <Text style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              {debt.status}
            </Text>
          )}
        </View>
        <Text style={styles.name}>{debt.counterpartyName}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        
        {remainingAmount !== originalAmount && (
          <View style={styles.balanceRow}>
            <Text style={styles.originalLabel}>Original: {amountLabel}</Text>
            <Text style={styles.remainingLabel}>Remaining: {remainingLabel}</Text>
          </View>
        )}
      </View>
      <View style={styles.right}>
        <View style={styles.amountBox}>
          {remainingAmount !== originalAmount ? (
            <>
              <Text style={styles.smallLabel}>Remaining</Text>
              <Text style={[styles.amount, { color: remainingAmount === 0 ? '#10B981' : '#7C3AED' }]}>
                {remainingLabel}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.smallLabel}>Amount</Text>
              <Text style={styles.amount}>{amountLabel}</Text>
            </>
          )}
        </View>

        {isPaid ? (
          <View style={styles.settledPill}>
            <Text style={styles.settledText}>Settled ✓</Text>
          </View>
        ) : (
          <>
            <Pressable style={styles.remindBtn} onPress={() => onRemind && onRemind(debt)}>
              <Text style={styles.remindText}>Remind</Text>
            </Pressable>
            <Pressable style={styles.settleBtn} onPress={() => onSettle && onSettle(debt)}>
              <Text style={styles.settleText}>Settle</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F6F3FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  left: { flex: 1, paddingRight: 12 },
  right: { alignItems: 'flex-end' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: C.PRIMARY_PURPLE, fontWeight: '800', fontSize: 14 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, fontSize: 11, fontWeight: '700', color: '#fff', overflow: 'hidden' },
  name: { color: C.TEXT_PRIMARY, marginTop: 6, fontWeight: '700' },
  subtitle: { color: C.TEXT_SECONDARY, marginTop: 4, fontSize: 12 },
  balanceRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(124, 58, 237, 0.2)', gap: 4 },
  originalLabel: { color: C.TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  remainingLabel: { color: '#7C3AED', fontSize: 12, fontWeight: '700' },
  amountBox: { marginBottom: 8 },
  smallLabel: { color: C.TEXT_SECONDARY, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  amount: { color: C.PRIMARY_PURPLE, fontWeight: '900', fontSize: 16 },
  remindBtn: { backgroundColor: '#EFEAFE', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6 },
  remindText: { color: C.PRIMARY_PURPLE, fontWeight: '700' },
  settleBtn: { backgroundColor: C.PRIMARY_PURPLE, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  settleText: { color: C.TEXT_ON_PURPLE, fontWeight: '800' },
  settledPill: { marginTop: 4, backgroundColor: '#ECFDF3', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#D1FAE5' },
  settledText: { color: '#15803D', fontWeight: '800' },
});
