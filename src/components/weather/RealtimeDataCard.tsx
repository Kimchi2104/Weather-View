
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MetricKey, MetricConfig } from '@/types/weather';
import MetricIcon from './MetricIcon';
import { Skeleton } from '@/components/ui/skeleton';
import MetricSparkline from './MetricSparkline'; // Import the new sparkline component

interface RealtimeDataCardProps {
  metricKey: MetricKey;
  value: number | string | null;
  unit: string;
  label: string;
  healthyMin?: number;
  healthyMax?: number;
  isLoading: boolean;
  isString?: boolean;
  dailyTrendData?: { timestamp: number; value: number | undefined }[];
  dailyMin?: number | string;
  dailyMax?: number | string;
  dailyAverage?: number; // Added prop for average
  lineColor?: string;
}

const RealtimeDataCard: FC<RealtimeDataCardProps> = ({
  metricKey,
  value,
  unit,
  label,
  healthyMin,
  healthyMax,
  isLoading,
  isString,
  dailyTrendData,
  dailyMin,
  dailyMax,
  dailyAverage, // Destructure average
  lineColor,
}) => {
  const isAlerting =
    !isString &&
    typeof value === 'number' &&
    value !== null &&
    ((healthyMin !== undefined && value < healthyMin) ||
     (healthyMax !== undefined && value > healthyMax));

  let displayValue: string | number | null = value;
  if (typeof value === 'number' && !isString) {
    if (metricKey === 'aqiPpm' || metricKey === 'rainAnalog') {
      displayValue = value.toFixed(0);
    } else {
      displayValue = value.toFixed(1);
    }
  }


  return (
    <Card className={`shadow-lg transition-all duration-300 flex flex-col ${isAlerting ? 'border-destructive bg-destructive/10' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium font-headline">{label}</CardTitle>
        <MetricIcon metric={metricKey} className="h-5 w-5" isAlerting={isAlerting} />
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        <div>
          {isLoading ? (
            <>
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-4 w-16" />
            </>
          ) : value !== null && value !== undefined ? (
            <>
              <div className={`text-2xl font-bold ${isAlerting ? 'text-destructive' : ''}`}>
                {displayValue}
                {unit && <span className="text-sm font-normal"> {unit}</span>}
              </div>
              {isAlerting && typeof value === 'number' && (
                <p className="text-xs text-destructive mt-1">
                  Value is {value < (healthyMin ?? -Infinity) ? 'below' : 'above'} healthy range ({healthyMin}-{healthyMax}{unit})
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No data</p>
          )}
        </div>
        {dailyTrendData && !isLoading && (
          <MetricSparkline
            data={dailyTrendData}
            dailyMin={dailyMin}
            dailyMax={dailyMax}
            dailyAverage={dailyAverage} // Pass average to sparkline
            unit={unit}
            metricKey={metricKey}
            lineColor={lineColor}
            isStringData={isString}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeDataCard;

