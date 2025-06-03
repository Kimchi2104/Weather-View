
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { GenerateWeatherForecastOutput } from '@/ai/flows/generate-weather-forecast';
import { Thermometer, CloudDrizzle } from 'lucide-react';

interface AIForecastChartProps {
  dailyForecasts: GenerateWeatherForecastOutput['dailyForecasts'];
}

const AIForecastChart: FC<AIForecastChartProps> = ({ dailyForecasts }) => {
  if (!dailyForecasts || dailyForecasts.length === 0) {
    return null; 
  }

  const chartConfig = {
    temperatureHigh: {
      label: 'High Temp (°C)',
      color: 'hsl(var(--chart-1))',
      icon: Thermometer,
    },
    temperatureLow: {
      label: 'Low Temp (°C)',
      color: 'hsl(var(--chart-2))',
      icon: Thermometer,
    },
    precipitationChance: {
      label: 'Precip. Chance (%)',
      color: 'hsl(var(--chart-3))',
      icon: CloudDrizzle,
    }
  } satisfies ChartConfig;

  const formattedData = dailyForecasts.map(day => ({
    date: day.date,
    temperatureHigh: day.temperatureHigh,
    temperatureLow: day.temperatureLow,
    precipitationChance: day.precipitationChance,
    // Tooltip will show daySummary
    tooltipPayload: [
        { name: 'High Temp', value: `${day.temperatureHigh}°C`, color: chartConfig.temperatureHigh.color },
        { name: 'Low Temp', value: `${day.temperatureLow}°C`, color: chartConfig.temperatureLow.color },
        { name: 'Precipitation', value: `${day.precipitationChance}%`, color: chartConfig.precipitationChance.color },
        { name: 'Summary', value: day.daySummary, color: 'hsl(var(--foreground))' },
    ]
  }));

  return (
    <Card className="shadow-lg mt-6">
      <CardHeader>
        <CardTitle className="font-headline">Daily Forecast Trend</CardTitle>
        <CardDescription>Visual representation of the AI-generated daily forecast.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-semibold mb-2 text-primary">Temperature Range</h4>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer>
                <LineChart data={formattedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `${value}°C`}
                    domain={['dataMin - 2', 'dataMax + 2']}
                  />
                  <Tooltip
                    content={<ChartTooltipContent indicator="line" />}
                    cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperatureHigh"
                    stroke={chartConfig.temperatureHigh.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: chartConfig.temperatureHigh.color }}
                    name="High Temp"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperatureLow"
                    stroke={chartConfig.temperatureLow.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: chartConfig.temperatureLow.color }}
                    name="Low Temp"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
          <div>
            <h4 className="text-md font-semibold mb-2 text-primary">Precipitation Chance</h4>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer>
                <BarChart data={formattedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                  />
                   <Tooltip
                    content={<ChartTooltipContent indicator="dot" />}
                    cursor={{ fill: 'hsl(var(--accent) / 0.3)'}}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey="precipitationChance"
                    fill={chartConfig.precipitationChance.color}
                    radius={[4, 4, 0, 0]}
                    name="Precip. Chance"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIForecastChart;
