
"use client";

import type { FC } from 'react';
import { useEffect, useState } from 'react';
import RealtimeDataCard from './RealtimeDataCard';
import type { WeatherDataPoint, MetricKey, MetricConfig, RawFirebaseDataPoint } from '@/types/weather';
import { database } from '@/lib/firebase'; 
import { ref, onValue, type Unsubscribe } from "firebase/database";
import { CloudRain, Thermometer, Droplets, SunDim, Wind } from 'lucide-react';
import { transformRawDataToWeatherDataPoint } from '@/lib/utils';


const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'var(--chart-1)', healthyMin: 0, healthyMax: 35 },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'var(--chart-2)', healthyMin: 30, healthyMax: 70 },
  precipitation: { name: 'Precipitation', unit: 'val', Icon: CloudRain, color: 'var(--chart-3)', healthyMax: 1000 }, // Assuming higher rainAnalog means less rain, 0 means heavy rain
  airQualityIndex: { name: 'Air Quality Index', unit: 'AQI', Icon: Wind, color: 'var(--chart-4)', healthyMax: 100 },
  lux: { name: 'Light Level', unit: 'lux', Icon: SunDim, color: 'var(--chart-5)' },
};

const RealtimeDataSection: FC = () => {
  const [realtimeData, setRealtimeData] = useState<WeatherDataPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // TODO: IMPORTANT! Update this path to the correct location of your weather data in Firebase.
  // This path should point to the parent node containing all your timestamped records.
  // Example: if your data is at /myWeatherStation/logs/, use 'myWeatherStation/logs'.
  const firebaseDataPath = 'allWeatherData'; // <<< --- USER NEEDS TO VERIFY AND CHANGE THIS

  useEffect(() => {
    const dataRef = ref(database, firebaseDataPath);
    console.log('[RealtimeDataSection] Setting up listener for data at:', dataRef.toString());
    
    const unsubscribe: Unsubscribe = onValue(dataRef, (snapshot) => {
      const rawDataContainer = snapshot.val();
      console.log('[RealtimeDataSection] Fetched realtime data container snapshot:', snapshot);
      console.log('[RealtimeDataSection] Realtime data container value:', rawDataContainer);
      
      if (rawDataContainer) {
        const allRecords: RawFirebaseDataPoint[] = Object.values(rawDataContainer);
        
        if (allRecords.length > 0) {
          const sortedRecords = allRecords
            .map(transformRawDataToWeatherDataPoint)
            .filter((point): point is WeatherDataPoint => point !== null)
            .sort((a, b) => b.timestamp - a.timestamp); // Sort descending to get latest

          if (sortedRecords.length > 0) {
            setRealtimeData(sortedRecords[0]);
            console.log('[RealtimeDataSection] Latest processed record:', sortedRecords[0]);
          } else {
            setRealtimeData(null);
            console.warn('[RealtimeDataSection] No valid records after transformation.');
          }
        } else {
          setRealtimeData(null);
          console.warn('[RealtimeDataSection] No records found in container.');
        }
      } else {
        setRealtimeData(null);
        console.warn(`[RealtimeDataSection] No data found at path: ${firebaseDataPath}`);
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

  const metricsOrder: MetricKey[] = ['temperature', 'humidity', 'precipitation', 'airQualityIndex', 'lux'];

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">Real-time Conditions</h2>
       <p className="text-xs text-muted-foreground mb-4">
            Ensure the Firebase path in the code (`RealtimeDataSection.tsx`) points to your data collection. Currently: `{firebaseDataPath}`.
        </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metricsOrder.map((key) => {
          const config = METRIC_CONFIGS[key];
          const value = realtimeData ? realtimeData[key as keyof WeatherDataPoint] : null;
          return (
            <RealtimeDataCard
              key={key}
              metricKey={key}
              value={typeof value === 'number' ? value : null}
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
