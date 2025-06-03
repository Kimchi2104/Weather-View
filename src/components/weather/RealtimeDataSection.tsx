"use client";

import type { FC } from 'react';
import { useEffect, useState } from 'react';
import RealtimeDataCard from './RealtimeDataCard';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
// TODO: Uncomment when firebase is configured
// import { database } from '@/lib/firebase'; 
// import { ref, onValue } from "firebase/database";
import { CloudRain, Thermometer, Droplets, SunDim, Wind } from 'lucide-react';

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'var(--chart-1)', healthyMin: 0, healthyMax: 35 },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'var(--chart-2)', healthyMin: 30, healthyMax: 70 },
  precipitation: { name: 'Precipitation', unit: 'mm', Icon: CloudRain, color: 'var(--chart-3)', healthyMax: 10 },
  airQualityIndex: { name: 'Air Quality Index', unit: 'AQI', Icon: Wind, color: 'var(--chart-4)', healthyMax: 100 },
  lightPollution: { name: 'Light Pollution', unit: 'lux', Icon: SunDim, color: 'var(--chart-5)' },
};


const RealtimeDataSection: FC = () => {
  const [realtimeData, setRealtimeData] = useState<WeatherDataPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual Firebase Realtime Database listener
    // This is a mock implementation.
    // Example Firebase listener:
    /*
    const weatherDataRef = ref(database, 'your-realtime-data-path'); // Replace 'your-realtime-data-path'
    const unsubscribe = onValue(weatherDataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRealtimeData(data);
      } else {
        setRealtimeData(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Firebase data fetching error:", error);
      setIsLoading(false);
      setRealtimeData(null);
    });
    return () => unsubscribe();
    */

    // Mock data fetching
    const mockFetch = setTimeout(() => {
      setRealtimeData({
        timestamp: Date.now(),
        temperature: 28.5,
        humidity: 65,
        precipitation: 0.2,
        airQualityIndex: 45,
        lightPollution: 300,
      });
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(mockFetch);
  }, []);

  const metricsOrder: MetricKey[] = ['temperature', 'humidity', 'precipitation', 'airQualityIndex', 'lightPollution'];

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">Real-time Conditions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metricsOrder.map((key) => {
          const config = METRIC_CONFIGS[key];
          return (
            <RealtimeDataCard
              key={key}
              metricKey={key}
              value={realtimeData ? realtimeData[key] : null}
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
