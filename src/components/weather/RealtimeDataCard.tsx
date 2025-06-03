
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MetricKey } from '@/types/weather';
import MetricIcon from './MetricIcon';
import { Skeleton } from '@/components/ui/skeleton';

interface RealtimeDataCardProps {
  metricKey: MetricKey;
  value: number | string | null; // Allow string for airQuality
  unit: string;
  label: string;
  healthyMin?: number;
  healthyMax?: number;
  isLoading: boolean;
}

const RealtimeDataCard: FC<RealtimeDataCardProps> = ({
  metricKey,
  value,
  unit,
  label,
  healthyMin,
  healthyMax,
  isLoading,
}) => {
  const isAlerting =
    typeof value === 'number' && // Only apply alert for numerical values
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
        ) : value !== null ? (
          <>
            <div className={`text-2xl font-bold ${isAlerting ? 'text-destructive' : ''}`}>
              {typeof value === 'number' ? value.toFixed(1) : value}
              {typeof value === 'number' && unit && <span className="text-sm font-normal"> {unit}</span>}
              {typeof value === 'string' && unit && <span className="text-sm font-normal"> {unit}</span>}
            </div>
            {isAlerting && (
              <p className="text-xs text-destructive mt-1">
                Outside healthy range
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
