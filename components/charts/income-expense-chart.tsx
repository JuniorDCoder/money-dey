import React from 'react';
import { Dimensions, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface Props {
  labels: string[];
  incomeSeries: number[];
  expenseSeries: number[];
  owedSeries?: number[];
  owingSeries?: number[];
  height?: number;
}

export default function IncomeExpenseChart({ labels, incomeSeries, expenseSeries, owedSeries = [], owingSeries = [], height = 220 }: Props) {
  const screenWidth = Dimensions.get('window').width - 40; // padding in dashboard

  const data = {
    labels,
    datasets: [
      {
        data: incomeSeries,
        color: () => '#34D399', // income color
        strokeWidth: 2,
      },
      {
        data: expenseSeries,
        color: () => '#FB7185', // expense color
        strokeWidth: 2,
      },
      ...(owedSeries.length ? [{ data: owedSeries, color: () => '#2563EB', strokeWidth: 2 }] : []),
      ...(owingSeries.length ? [{ data: owingSeries, color: () => '#F97316', strokeWidth: 2 }] : []),
    ],
    legend: ['Income', 'Expenses', ...(owedSeries.length ? ['Owed to you'] : []), ...(owingSeries.length ? ['You owe'] : [])],
  };

  const chartConfig = {
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    color: (opacity = 1) => `rgba(60,60,67, ${opacity})`,
    strokeWidth: 2,
    decimalPlaces: 0,
    propsForDots: {
      r: '3',
      strokeWidth: '1',
      stroke: '#fff',
    },
    fillShadowGradientOpacity: 0,
  };

  return (
    <View style={{ marginTop: 12 }}>
      <LineChart
        data={data}
        width={screenWidth}
        height={height}
        chartConfig={chartConfig}
        style={{ borderRadius: 16 }}
        fromZero
        withShadow={false}
      />
    </View>
  );
}
