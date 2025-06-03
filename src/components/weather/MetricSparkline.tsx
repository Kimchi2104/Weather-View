
"use client";

import type { FC } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { CardDescription } from '@/components/ui/card';

interface MetricSparklineProps {
  data: { timestamp: number; value: number | undefined }[];
  dailyMin?: number | string;
  dailyMax?: number | string;
  dailyAverage?: number; // Added prop for average
  unit: string;
  metricKey: string;
  lineColor?: string;
  isStringData?: boolean;
}

const MetricSparkline: FC<MetricSparklineProps> = ({ data, dailyMin, dailyMax, dailyAverage, unit, metricKey, lineColor = 'hsl(var(--primary))', isStringData }) => {
  const hasTrendStats = dailyMin !== undefined || dailyMax !== undefined || dailyAverage !== undefined;

  if (isStringData || !data || data.length < 2) {
    if (hasTrendStats) {
      const parts = [];
      if (dailyAverage !== undefined) {
          parts.push(`Avg: ${dailyAverage.toFixed(1)}${unit}`);
      }
      if (dailyMin !== undefined) {
          parts.push(`Min: ${typeof dailyMin === 'number' ? dailyMin.toFixed(1) : dailyMin}${unit}`);
      }
      if (dailyMax !== undefined) {
          parts.push(`Max: ${typeof dailyMax === 'number' ? dailyMax.toFixed(1) : dailyMax}${unit}`);
      }
      if (parts.length > 0) {
        return (
            <CardDescription className="text-xs mt-1">
                Day: {parts.join(' / ')}
            </CardDescription>
        );
      }
    }
    return null;
  }

  const validData = data.filter(p => p.value !== undefined);
  if (validData.length < 2) {
     if (hasTrendStats) {
        const parts = [];
        if (dailyAverage !== undefined) {
            parts.push(`Avg: ${dailyAverage.toFixed(1)}${unit}`);
        }
        if (dailyMin !== undefined) {
            parts.push(`Min: ${typeof dailyMin === 'number' ? dailyMin.toFixed(1) : dailyMin}${unit}`);
        }
        if (dailyMax !== undefined) {
            parts.push(`Max: ${typeof dailyMax === 'number' ? dailyMax.toFixed(1) : dailyMax}${unit}`);
        }
        if (parts.length > 0) {
          return (
              <CardDescription className="text-xs mt-1">
                  Day: {parts.join(' / ')}
              </CardDescription>
          );
        }
    }
    return null;
  }


  return (
    <div className="mt-1">
      <div className="h-10 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={validData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              name={metricKey} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasTrendStats && (() => {
        const parts = [];
        if (dailyAverage !== undefined) {
            parts.push(`Avg: ${dailyAverage.toFixed(1)}${unit}`);
        }
        if (dailyMin !== undefined) {
            parts.push(`Min: ${typeof dailyMin === 'number' ? dailyMin.toFixed(1) : dailyMin}${unit}`);
        }
        if (dailyMax !== undefined) {
            parts.push(`Max: ${typeof dailyMax === 'number' ? dailyMax.toFixed(1) : dailyMax}${unit}`);
        }
        if (parts.length > 0) {
            return (
                <CardDescription className="text-xs text-center mt-0.5">
                    {parts.join(' / ')}
                </CardDescription>
            );
        }
        return null;
      })()}
    </div>
  );
};

export default MetricSparkline;

