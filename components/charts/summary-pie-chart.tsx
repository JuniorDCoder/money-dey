import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

type PieDatum = {
  label: string;
  value: number;
  color: string;
};

interface SummaryPieChartProps {
  data: PieDatum[];
  size?: number; // diameter
  thickness?: number; // donut thickness
}

export default function SummaryPieChart({ data, size, thickness = 20 }: SummaryPieChartProps) {
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const chartSize = size || Math.min(260, SCREEN_WIDTH * 0.8);
  const radius = chartSize / 2 - thickness / 2;
  const circumference = 2 * Math.PI * radius;

  const cleaned = useMemo(() => {
    const total = data.reduce((s, d) => s + Math.max(0, Number(d.value || 0)), 0);
    return {
      total,
      segments: data.map((d) => ({
        ...d,
        value: Math.max(0, Number(d.value || 0)),
      })),
    };
  }, [data]);

  const segmentsWithLengths = useMemo(() => {
    let offset = 0;
    const res = cleaned.segments.map((seg) => {
      const length = cleaned.total > 0 ? (seg.value / cleaned.total) * circumference : 0;
      const out = { ...seg, length, offset };
      offset += length;
      return out;
    });
    return res;
  }, [cleaned.segments, cleaned.total, circumference]);

  const showEmpty = cleaned.total <= 0;

  return (
    <View style={styles.container}>
      <View style={{ width: chartSize, height: chartSize }}>
        {showEmpty ? (
          <View style={[styles.empty, { width: chartSize, height: chartSize }] }>
            <Text style={styles.emptyText}>No data to chart</Text>
          </View>
        ) : (
          <Svg width={chartSize} height={chartSize}>
            {/* Background ring */}
            <Circle
              cx={chartSize / 2}
              cy={chartSize / 2}
              r={radius}
              stroke="#EFEAFE"
              strokeWidth={thickness}
              fill="none"
            />

            {/* Colored segments, rotated to start at the top and centered */}
            <G rotation={-90} origin={`${chartSize / 2}, ${chartSize / 2}`}>
              {segmentsWithLengths.map((seg) => (
                <Circle
                  key={seg.label}
                  cx={chartSize / 2}
                  cy={chartSize / 2}
                  r={radius}
                  stroke={seg.color}
                  strokeWidth={thickness}
                  fill="none"
                  strokeDasharray={`${seg.length}, ${circumference - seg.length}`}
                  strokeDashoffset={circumference - seg.offset}
                  strokeLinecap="butt"
                />
              ))}
            </G>
          </Svg>
        )}
        {/* Center label with total */}
        <View style={[styles.centerLabel, { width: chartSize, height: chartSize }] }>
          <Text style={styles.centerTitle}>Analytics</Text>
          {!showEmpty && (
            <Text style={styles.centerValue}>{cleaned.total.toLocaleString()}</Text>
          )}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {data.map((d) => {
          const pct = cleaned.total > 0 ? Math.round((Math.max(0, d.value) / cleaned.total) * 100) : 0;
          return (
            <View key={d.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: d.color }]} />
              <Text style={styles.legendText}>{d.label}</Text>
              <Text style={styles.legendPct}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%'
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  emptyText: {
    color: '#64748B'
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerTitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700'
  },
  centerValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '900',
    color: '#111827'
  },
  legend: {
    marginTop: 12,
    width: '90%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFFEE',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: '45%'
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  legendText: {
    color: '#111827',
    fontWeight: '700',
    flex: 1
  },
  legendPct: {
    color: '#6B7280',
    fontWeight: '800'
  }
});
