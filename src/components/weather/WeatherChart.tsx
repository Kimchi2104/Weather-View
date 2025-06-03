"use client";

import type { FC } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';

interface WeatherChartProps {
  data: WeatherDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
}

const WeatherChart: FC<WeatherChartProps> = ({ data, selectedMetrics, metricConfigs, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-1/2 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Historical Data</CardTitle>
          <CardDescription>No data available for the selected range or metrics.</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Please select a date range and metrics to view data.</p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig: ChartConfig = Object.fromEntries(
    selectedMetrics.map(key => [
      key,
      {
        label: metricConfigs[key].name,
        color: metricConfigs[key].color,
      },
    ])
  ) as ChartConfig;

  const formattedData = data.map(point => ({
    ...point,
    timestamp: format(new Date(point.timestamp), 'MMM d, HH:mm'),
  }));

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Historical Data Trends</CardTitle>
        <CardDescription>Interactive chart displaying selected weather metrics over time.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                tickFormatter={(value) => value}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(value) => typeof value === 'number' ? value.toFixed(0) : value}
              />
              <Tooltip
                content={<ChartTooltipContent />}
                cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1 }}
                wrapperStyle={{ outline: 'none' }}
              />
              <Legend content={<ChartLegendContent />} />
              {selectedMetrics.map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={metricConfigs[key].color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: metricConfigs[key].color }}
                  activeDot={{ r: 4 }}
                  name={metricConfigs[key].name}
                  unit={metricConfigs[key].unit}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default WeatherChart;
