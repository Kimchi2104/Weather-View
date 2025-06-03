
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MetricKey, MetricConfig } from '@/types/weather'; // MetricConfig might be useful here
import MetricIcon from './MetricIcon';
import { Skeleton } from '@/components/ui/skeleton';

interface RealtimeDataCardProps {
  metricKey: MetricKey;
  value: number | string | null;
  unit: string;
  label: string;
  healthyMin?: number;
  healthyMax?: number;
  isLoading: boolean;
  isString?: boolean; // To know if we should apply numeric formatting/checks
}

const RealtimeDataCard: FC<RealtimeDataCardProps> = ({
  metricKey,
  value,
  unit,
  label,
  healthyMin,
  healthyMax,
  isLoading,
  isString, // Use this prop from MetricConfig
}) => {
  const isAlerting =
    !isString && // Only alert for numerical values
    typeof value === 'number' && 
    value !== null &&
    ((healthyMin !== undefined && value < healthyMin) ||
     (healthyMax !== undefined && value > healthyMax));

  return (
    <Card className={`shadow-lg transition-all duration-300 ${isAlerting ? 'border-destructive bg-destructive/10' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium font-headline">{label}</CardTitle>
        <MetricIcon metric={metricKey} className="h-5 w-5" isAlerting={isAlerting} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-4 w-16" />
          </>
        ) : value !== null && value !== undefined ? (
          <>
            <div className={`text-2xl font-bold ${isAlerting ? 'text-destructive' : ''}`}>
              {typeof value === 'number' && !isString ? value.toFixed(metricKey === 'aqiPpm' ? 0 : 1) : value} 
              {unit && <span className="text-sm font-normal"> {unit}</span>}
            </div>
            {isAlerting && typeof value === 'number' && ( // Ensure value is number for this message
              <p className="text-xs text-destructive mt-1">
                Value is {value < (healthyMin ?? -Infinity) ? 'below' : 'above'} healthy range ({healthyMin}-{healthyMax}{unit})
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No data</p>
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeDataCard;

