
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // Removed Legend as ChartLegendContent is used
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
          <p className="text-muted-foreground">Please select a date range and metrics to view data, or check data source.</p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = Object.fromEntries(
    selectedMetrics.map(key => [
      key,
      {
        label: metricConfigs[key].name,
        color: metricConfigs[key].color,
        icon: metricConfigs[key].Icon, // Pass icon to chart config for legend
      },
    ])
  ) as ChartConfig;
  

  const formattedData = data.map(point => ({
    ...point,
    // Format timestamp for X-axis display
    // Ensure point.timestamp is a valid number (milliseconds)
    timestampDisplay: typeof point.timestamp === 'number' ? format(new Date(point.timestamp), 'MMM d, HH:mm') : 'Invalid Date',
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
            <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="timestampDisplay" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                // tickFormatter={(value) => value} // Already formatted in data
                angle={-15} // Angle ticks for better readability if many points
                textAnchor="end"
                minTickGap={20} // Ensure some spacing between ticks
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(value) => typeof value === 'number' ? value.toFixed(0) : value}
                domain={['auto', 'auto']} // Auto domain or specify if needed
              />
              <Tooltip
                content={<ChartTooltipContent indicator="line" />}
                cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}
                wrapperStyle={{ outline: 'none', zIndex: 100 }}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedMetrics.map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={metricConfigs[key].color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: metricConfigs[key].color, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 1, stroke: metricConfigs[key].color }}
                  name={metricConfigs[key].name}
                  unit={metricConfigs[key].unit}
                  connectNulls={false} // Decide if you want to connect lines over null data points
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
