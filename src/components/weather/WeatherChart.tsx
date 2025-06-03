
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';

interface WeatherChartProps {
  data: WeatherDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
  onPointClick?: (point: WeatherDataPoint) => void;
  onRangeSelect?: (points: WeatherDataPoint[]) => void; // New prop for range selection
}

const WeatherChart: FC<WeatherChartProps> = ({ data, selectedMetrics, metricConfigs, isLoading, onPointClick, onRangeSelect }) => {
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
      const { timestampDisplay, ...originalPoint } = clickedPointData;
      onPointClick(originalPoint as WeatherDataPoint);
    }
  };

  const handleBrushChange = (e: any) => { // e: { startIndex?: number; endIndex?: number } from Brush onChange
    if (onRangeSelect && e && typeof e.startIndex === 'number' && typeof e.endIndex === 'number') {
      // formattedData is the array used by the chart, so indices from Brush refer to it
      const selectedSlice = formattedData.slice(e.startIndex, e.endIndex + 1);
      const originalPoints = selectedSlice.map(pointWithDisplay => {
        const { timestampDisplay, ...rest } = pointWithDisplay;
        return rest as WeatherDataPoint; 
      });
      if (originalPoints.length > 0) {
        onRangeSelect(originalPoints);
      }
    } else if (onRangeSelect && (!e || typeof e.startIndex !== 'number')) {
      // This case might occur if the brush is cleared or the event is malformed.
      // Optionally call onRangeSelect with an empty array or null to signify clearing.
      // onRangeSelect([]); 
    }
  };
  
  if (!data || data.length === 0) { // Moved this check after isLoading to prioritize loading skeleton
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>No data available for the selected range or metrics. Use date picker above or select a range on the chart.</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Please select a date range and metrics to view data, or check data source.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Historical Data Trends</CardTitle>
        <CardDescription>Interactive chart displaying selected weather metrics. Click a point or drag on the chart to select a range for AI forecast.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[450px] w-full"> {/* Increased height for Brush */}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={formattedData} 
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              onClick={handleChartClick}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="timestampDisplay" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                angle={-15}
                textAnchor="end"
                minTickGap={20}
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
                  connectNulls={false}
                />
              ))}
              <Brush 
                dataKey="timestampDisplay" 
                height={30} 
                stroke="hsl(var(--primary))"
                startIndex={undefined} // Allow brush to be unselected initially
                endIndex={undefined}
                onChange={handleBrushChange}
                tickFormatter={(index) => formattedData[index]?.timestampDisplay.split(',')[0] || ''} // Show only date part in brush ticks
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default WeatherChart;
