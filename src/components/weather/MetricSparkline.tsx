
"use client";

import type { FC } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { CardDescription } from '@/components/ui/card';

interface MetricSparklineProps {
  data: { timestamp: number; value: number | undefined }[]; // Array of data points for the sparkline
  dailyMin?: number | string;
  dailyMax?: number | string;
  unit: string;
  metricKey: string; // To ensure unique line keys if multiple sparklines are on one card (not current case)
  lineColor?: string;
  isStringData?: boolean;
}

const MetricSparkline: FC<MetricSparklineProps> = ({ data, dailyMin, dailyMax, unit, metricKey, lineColor = 'hsl(var(--primary))', isStringData }) => {
  if (isStringData || !data || data.length < 2) {
    // Don't render sparkline for string data or if not enough data points
    if (dailyMin !== undefined && dailyMax !== undefined) {
         return (
            <CardDescription className="text-xs mt-1">
                Day: {typeof dailyMin === 'number' ? dailyMin.toFixed(1) : dailyMin}{unit} - {typeof dailyMax === 'number' ? dailyMax.toFixed(1) : dailyMax}{unit}
            </CardDescription>
        );
    }
    return null;
  }

  // Filter out points where value is undefined to prevent chart errors
  const validData = data.filter(p => p.value !== undefined);
  if (validData.length < 2) {
     if (dailyMin !== undefined && dailyMax !== undefined) {
         return (
            <CardDescription className="text-xs mt-1">
                Day: {typeof dailyMin === 'number' ? dailyMin.toFixed(1) : dailyMin}{unit} - {typeof dailyMax === 'number' ? dailyMax.toFixed(1) : dailyMax}{unit}
            </CardDescription>
        );
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
              name={metricKey} // mainly for Recharts internals
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {(dailyMin !== undefined && dailyMax !== undefined) && (
         <CardDescription className="text-xs text-center mt-0.5">
          Day Min/Max: {typeof dailyMin === 'number' ? dailyMin.toFixed(1) : dailyMin}{unit} / {typeof dailyMax === 'number' ? dailyMax.toFixed(1) : dailyMax}{unit}
        </CardDescription>
      )}
    </div>
  );
};

export default MetricSparkline;
