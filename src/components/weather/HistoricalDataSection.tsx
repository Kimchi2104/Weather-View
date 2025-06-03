"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import DateRangePicker from './DateRangePicker';
import DataSelector from './DataSelector';
import WeatherChart from './WeatherChart';
import type { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
// TODO: Uncomment when firebase is configured
// import { database } from '@/lib/firebase';
// import { ref, query, orderByChild, startAt, endAt, get } from "firebase/database";
import { CloudRain, Thermometer, Droplets, SunDim, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const AVAILABLE_METRICS: { key: MetricKey; name: string }[] = [
  { key: 'temperature', name: 'Temperature' },
  { key: 'humidity', name: 'Humidity' },
  { key: 'precipitation', name: 'Precipitation' },
  { key: 'airQualityIndex', name: 'AQI' },
  { key: 'lightPollution', name: 'Light Pollution' },
];

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'hsl(var(--chart-1))' },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'hsl(var(--chart-2))' },
  precipitation: { name: 'Precipitation', unit: 'mm', Icon: CloudRain, color: 'hsl(var(--chart-3))' },
  airQualityIndex: { name: 'Air Quality Index', unit: 'AQI', Icon: Wind, color: 'hsl(var(--chart-4))' },
  lightPollution: { name: 'Light Pollution', unit: 'lux', Icon: SunDim, color: 'hsl(var(--chart-5))' },
};

const HistoricalDataSection: FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(startOfDay(new Date()), 7),
    to: endOfDay(new Date()),
  });
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['temperature', 'humidity']);
  const [historicalData, setHistoricalData] = useState<WeatherDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistoricalData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to || selectedMetrics.length === 0) {
      setHistoricalData([]);
      return;
    }
    setIsLoading(true);

    // TODO: Replace with actual Firebase data fetching
    // This is a mock implementation.
    // Example Firebase query:
    /*
    try {
      const historicalRef = ref(database, 'your-historical-data-path'); // Replace
      const q = query(
        historicalRef,
        orderByChild('timestamp'),
        startAt(dateRange.from.getTime()),
        endAt(dateRange.to.getTime())
      );
      const snapshot = await get(q);
      if (snapshot.exists()) {
        const rawData = snapshot.val();
        // Process rawData into WeatherDataPoint[] format
        const processedData = Object.values(rawData) as WeatherDataPoint[]; 
        setHistoricalData(processedData);
      } else {
        setHistoricalData([]);
      }
    } catch (error) {
      console.error("Firebase historical data fetching error:", error);
      setHistoricalData([]);
    } finally {
      setIsLoading(false);
    }
    */

    // Mock data generation
    await new Promise(resolve => setTimeout(resolve, 1500));
    const generateMockData = (from: Date, to: Date): WeatherDataPoint[] => {
      const data: WeatherDataPoint[] = [];
      let currentTime = from.getTime();
      const endTime = to.getTime();
      const interval = 3600 * 1000 * 3; // 3 hours

      while (currentTime <= endTime) {
        data.push({
          timestamp: currentTime,
          temperature: 15 + Math.random() * 15, // 15-30°C
          humidity: 40 + Math.random() * 40, // 40-80%
          precipitation: Math.random() > 0.8 ? Math.random() * 5 : 0, // mm
          airQualityIndex: 10 + Math.random() * 90, // 10-100 AQI
          lightPollution: Math.random() * 500, // lux
        });
        currentTime += interval;
      }
      return data;
    };
    
    setHistoricalData(generateMockData(dateRange.from, dateRange.to));
    setIsLoading(false);
  }, [dateRange, selectedMetrics]);


  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);


  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">Historical Data Analysis</h2>
      <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <Label htmlFor="date-range-picker" className="text-sm font-medium text-muted-foreground mb-1 block">Select Date Range:</Label>
            <DateRangePicker onDateChange={setDateRange} initialRange={dateRange} id="date-range-picker"/>
          </div>
          <Button onClick={fetchHistoricalData} disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? 'Loading...' : 'Load Data'}
          </Button>
        </div>
        <DataSelector
          availableMetrics={AVAILABLE_METRICS}
          selectedMetrics={selectedMetrics}
          onSelectionChange={setSelectedMetrics}
        />
      </div>
      <div className="mt-6">
        <WeatherChart 
          data={historicalData} 
          selectedMetrics={selectedMetrics} 
          metricConfigs={METRIC_CONFIGS}
          isLoading={isLoading}
        />
      </div>
    </section>
  );
};

export default HistoricalDataSection;
