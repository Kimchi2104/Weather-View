
"use client";

import type { FC } from 'react';
import { useEffect, useState } from 'react';
import RealtimeDataCard from './RealtimeDataCard';
import type { WeatherDataPoint, MetricKey, MetricConfig, RawFirebaseDataPoint } from '@/types/weather';
import { database } from '@/lib/firebase';
import { ref, onValue, type Unsubscribe } from "firebase/database";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import MetricIcon from './MetricIcon'; // For the combined card
import { CloudRain, Thermometer, Droplets, SunDim, Wind, Gauge, ShieldCheck } from 'lucide-react';
import { transformRawDataToWeatherDataPoint } from '@/lib/utils';

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'var(--chart-1)', healthyMin: 0, healthyMax: 35 },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'var(--chart-2)', healthyMin: 30, healthyMax: 70 },
  precipitation: { name: 'Precipitation', unit: '', Icon: CloudRain, color: 'var(--chart-3)', isString: true },
  airQuality: { name: 'Air Quality', unit: '', Icon: ShieldCheck, color: 'var(--chart-4)', isString: true },
  aqiPpm: { name: 'AQI (ppm)', unit: 'ppm', Icon: Wind, color: 'var(--chart-5)', healthyMin: 0, healthyMax: 300 },
  lux: { name: 'Light Level', unit: 'lux', Icon: SunDim, color: 'hsl(30, 80%, 55%)' },
  pressure: { name: 'Pressure', unit: 'hPa', Icon: Gauge, color: 'hsl(120, 60%, 45%)', healthyMin: 980, healthyMax: 1040 },
};

const RealtimeDataSection: FC = () => {
  const [realtimeData, setRealtimeData] = useState<WeatherDataPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const firebaseDataPath = 'devices/TGkMhLL4k4ZFBwgOyRVNKe5mTQq1/records';

  useEffect(() => {
    const dataRef = ref(database, firebaseDataPath);
    console.log('[RealtimeDataSection] Setting up listener for realtime data at Firebase path:', dataRef.toString());

    const unsubscribe: Unsubscribe = onValue(dataRef, (snapshot) => {
      console.log('[RealtimeDataSection] Realtime data snapshot received from Firebase:', snapshot);
      const rawDataContainer = snapshot.val();
      console.log('[RealtimeDataSection] Raw realtime data container from Firebase:', JSON.parse(JSON.stringify(rawDataContainer)));

      if (rawDataContainer && typeof rawDataContainer === 'object') {
        const allRecords: [string, RawFirebaseDataPoint][] = Object.entries(rawDataContainer);
        console.log(`[RealtimeDataSection] Number of raw records in container (Object.entries): ${allRecords.length}`);

        if (allRecords.length > 0) {
          const sortedRecords = allRecords
            .map(([key, rawPoint]) => {
                console.log(`[RealtimeDataSection] Processing raw point for realtime with key: ${key}`);
                return transformRawDataToWeatherDataPoint(rawPoint as RawFirebaseDataPoint, key);
            })
            .filter((point): point is WeatherDataPoint => {
                const isValid = point !== null;
                if (!isValid) console.warn('[RealtimeDataSection] A realtime point was filtered out after transformation (returned null).');
                return isValid;
            })
            .sort((a, b) => b.timestamp - a.timestamp); 

          if (sortedRecords.length > 0) {
            setRealtimeData(sortedRecords[0]);
            console.log('[RealtimeDataSection] Latest processed record for realtime display:', JSON.parse(JSON.stringify(sortedRecords[0])));
          } else {
            setRealtimeData(null);
            console.warn('[RealtimeDataSection] No valid records after transformation for realtime display.');
          }
        } else {
          setRealtimeData(null);
          console.warn('[RealtimeDataSection] No records found in realtime data container.');
        }
      } else {
        setRealtimeData(null);
        console.warn(`[RealtimeDataSection] No data or invalid data structure found at Firebase path: ${firebaseDataPath}`);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("[RealtimeDataSection] Firebase realtime data fetching error:", error);
      setIsLoading(false);
      setRealtimeData(null);
    });

    return () => {
      console.log('[RealtimeDataSection] Unsubscribing from realtime data listener.');
      unsubscribe();
    };
  }, [firebaseDataPath]);

  const individualMetricsOrder: MetricKey[] = ['temperature', 'humidity', 'aqiPpm', 'lux', 'pressure'];

  const precipitationValue = realtimeData?.precipitation;
  const airQualityValue = realtimeData?.airQuality;

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">Real-time Conditions</h2>
       <p className="text-xs text-muted-foreground mb-4">
            Data is fetched from Firebase path: `{firebaseDataPath}`.
        </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Combined Card for Precipitation and Air Quality */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-headline">Current Status</CardTitle>
            {/* General icon or leave it out for combined card */}
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center">
                  <MetricIcon metric="precipitation" className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">{METRIC_CONFIGS.precipitation.name}:</span>
                  <span className="text-sm ml-1">{precipitationValue ?? 'N/A'}</span>
                </div>
                <div className="flex items-center">
                  <MetricIcon metric="airQuality" className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">{METRIC_CONFIGS.airQuality.name}:</span>
                  <span className="text-sm ml-1">{airQualityValue ?? 'N/A'}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Individual Cards for other metrics */}
        {individualMetricsOrder.map((key) => {
          const config = METRIC_CONFIGS[key];
          if (!config) {
            console.warn(`[RealtimeDataSection] Missing metric config for key: ${key}`);
            return null;
          }
          let value: number | string | null = null;
          if (realtimeData) {
             if (key === 'aqiPpm') value = realtimeData.aqiPpm;
             else if (key === 'airQuality') value = realtimeData.airQuality; // This case won't be hit due to filtering
             else value = realtimeData[key as Exclude<MetricKey, 'aqiPpm' | 'airQuality'>];
          }
          
          return (
            <RealtimeDataCard
              key={key}
              metricKey={key}
              value={value}
              unit={config.unit}
              label={config.name}
              healthyMin={config.isString ? undefined : config.healthyMin}
              healthyMax={config.isString ? undefined : config.healthyMax}
              isLoading={isLoading}
              isString={config.isString}
            />
          );
        })}
      </div>
    </section>
  );
};

export default RealtimeDataSection;
