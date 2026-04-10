// src/components/PowerChart.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../themes/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface PowerChartProps {
  data: number[];
  label?: string;
}

export function PowerChart({ data, label = 'Power Trend (kW)' }: PowerChartProps) {
  const { theme } = useTheme();

  const chartData = useMemo(() => {
    if (data.length === 0) {
      return {
        labels: ['0s'],
        datasets: [{ data: [0] }],
      };
    }

    const recentData = data.slice(-20);
    const labels = recentData.map((_, i) => {
      const seconds = (recentData.length - 1 - i) * 5;
      if (seconds === 0) return 'Now';
      if (seconds < 60) return `${seconds}s`;
      return `${Math.floor(seconds / 60)}m`;
    });

    return {
      labels,
      datasets: [
        {
          data: recentData,
          color: (opacity = 1) => theme.chartLine,
          strokeWidth: 3,
        },
      ],
    };
  }, [data, theme.chartLine]);

  const chartConfig = useMemo(() => ({
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    backgroundGradientFromOpacity: 1,
    backgroundGradientToOpacity: 1,
    color: (opacity = 1) => theme.chartLine,
    strokeWidth: 3,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForDots: {
      r: '0',
      strokeWidth: '0',
      stroke: theme.chartLine,
    },
    propsForBackgroundLines: {
      strokeDasharray: '4,4',
      stroke: theme.chartGrid,
      strokeWidth: 1,
    },
    propsForLabels: {
      fontSize: 10,
      fill: theme.chartLabel,
    },
    decimalPlaces: 0,
  }), [theme.card, theme.chartLine, theme.chartGrid, theme.chartLabel]);

  const maxPower = data.length > 0 ? Math.max(...data, 1) : 1;

  if (data.length < 2) {
    return (
      <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textMuted }]}>POWER TREND (kW)</Text>
        </View>
        <View style={styles.waitingContainer}>
          <Text style={[styles.waitingText, { color: theme.textSecondary }]}>
            📊 Collecting data...
          </Text>
          <Text style={[styles.waitingSub, { color: theme.textMuted }]}>
            Power readings will appear here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textMuted }]}>POWER TREND (kW)</Text>
        <Text style={[styles.maxValue, { color: theme.accentBright }]}>
          Max: {maxPower.toFixed(1)} kW
        </Text>
      </View>
      
      <LineChart
        data={chartData}
        width={SCREEN_WIDTH - 48}
        height={200}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        fromZero
        yAxisSuffix=""
        yAxisInterval={1}
        hideLegend
        segments={4}
        withVerticalLines={false}
        withHorizontalLines={true}
        withInnerLines={true}
        withOuterLines={true}
        withVerticalLabels={false}
        withHorizontalLabels={true}
      />
      
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textMuted }]}>
          ← Last {data.length} readings (5s intervals)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  maxValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  waitingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  waitingSub: {
    fontSize: 12,
  },
  footer: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
});