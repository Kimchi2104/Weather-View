
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';

interface WeatherChartProps {
  data: WeatherDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
  onPointClick?: (point: WeatherDataPoint) => void;
  // onRangeSelect is removed as Brush is removed
}

const WeatherChart: FC<WeatherChartProps> = ({ data, selectedMetrics, metricConfigs, isLoading, onPointClick }) => {
  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-1/2 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[450px] w-full" />
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
        icon: metricConfigs[key].Icon,
      },
    ])
  ) as ChartConfig;
  
  const formattedData = data.map(point => ({
    ...point,
    timestampDisplay: typeof point.timestamp === 'number' ? format(new Date(point.timestamp), 'MMM d, HH:mm') : 'Invalid Date',
  }));

  const handleChartClick = (event: any) => {
    if (onPointClick && event && event.activePayload && event.activePayload.length > 0) {
      const clickedPointData = event.activePayload[0].payload;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timestampDisplay, ...originalPoint } = clickedPointData;
      onPointClick(originalPoint as WeatherDataPoint);
    }
  };

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>No data available for the selected range or metrics. Use date picker above.</CardDescription>
        </CardHeader>
        <CardContent className="h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">Please select a date range and metrics to view data, or check data source.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Historical Data Trends</CardTitle>
        <CardDescription>
          Interactive chart displaying selected weather metrics. 
          Click a point on the chart to use it for AI forecast, or use the button in the &quot;Historical Data Analysis&quot; section below the date picker to use all currently displayed data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={formattedData} 
              margin={{ top: 5, right: 30, left: 0, bottom: 50 }}
              onClick={handleChartClick}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="timestampDisplay" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                angle={-30} 
                textAnchor="end"
                minTickGap={40} 
                height={60} 
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(value) => typeof value === 'number' ? value.toFixed(0) : value}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={<ChartTooltipContent indicator="line" />}
                cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}
                wrapperStyle={{ outline: 'none', zIndex: 100 }}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedMetrics.map((key) => {
                const metricConfig = metricConfigs[key];
                if (metricConfig.isString) return null; 

                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={metricConfig.color}
                    strokeWidth={2}
                    dot={{ r: 2, fill: metricConfig.color, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 1, stroke: metricConfig.color }}
                    name={metricConfig.name}
                    unit={metricConfig.unit}
                    connectNulls={false}
                  />
                );
              })}
              {/* Brush component removed */}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default WeatherChart;
