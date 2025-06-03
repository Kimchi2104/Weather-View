
"use client";

import type { FC } from 'react';
import { useEffect, useState } from 'react';
import RealtimeDataCard from './RealtimeDataCard';
import type { WeatherDataPoint, MetricKey, MetricConfig, RawFirebaseDataPoint } from '@/types/weather';
import { database } from '@/lib/firebase';
import { ref, onValue, type Unsubscribe } from "firebase/database";
import { CloudRain, Thermometer, Droplets, SunDim, Wind, Gauge } from 'lucide-react';
import { transformRawDataToWeatherDataPoint } from '@/lib/utils';

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'var(--chart-1)', healthyMin: 0, healthyMax: 35 },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'var(--chart-2)', healthyMin: 30, healthyMax: 70 },
  precipitation: { name: 'Precipitation', unit: '', Icon: CloudRain, color: 'var(--chart-3)' }, // Unit empty for string data
  airQuality: { name: 'Air Quality', unit: '', Icon: Wind, color: 'var(--chart-4)' }, // No min/max for string categories
  lux: { name: 'Light Level', unit: 'lux', Icon: SunDim, color: 'var(--chart-5)' },
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

  const metricsOrder: MetricKey[] = ['temperature', 'humidity', 'precipitation', 'airQuality', 'lux', 'pressure'];

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">Real-time Conditions</h2>
       <p className="text-xs text-muted-foreground mb-4">
            Data is fetched from Firebase path: `{firebaseDataPath}`.
        </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricsOrder.map((key) => {
          const config = METRIC_CONFIGS[key];
          if (!config) {
            console.warn(`[RealtimeDataSection] Missing metric config for key: ${key}`);
            return null;
          }
          const value = realtimeData ? realtimeData[key as keyof WeatherDataPoint] : null;
          
          return (
            <RealtimeDataCard
              key={key}
              metricKey={key}
              value={value as number | string | null} // Cast to allow string for airQuality and precipitation
              unit={config.unit}
              label={config.name}
              healthyMin={config.healthyMin}
              healthyMax={config.healthyMax}
              isLoading={isLoading}
            />
          );
        })}
      </div>
    </section>
  );
};

export default RealtimeDataSection;
