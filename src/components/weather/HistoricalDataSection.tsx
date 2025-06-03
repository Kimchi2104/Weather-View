
"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import DateRangePicker from './DateRangePicker';
import DataSelector from './DataSelector';
import WeatherChart from './WeatherChart';
import type { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
import { database } from '@/lib/firebase';
import { ref, query, orderByChild, startAt, endAt, get, type DataSnapshot } from "firebase/database";
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
    if (!dateRange?.from || !dateRange?.to) {
      console.warn('[HistoricalDataSection] Date range is not fully selected. Aborting fetch.');
      setHistoricalData([]);
      return;
    }
    setIsLoading(true);

    // TODO: Replace 'weather/historical/station1' with the actual path to your historical weather data in Firebase.
    // Ensure your Firebase Realtime Database rules allow reading this path and that it's indexed on 'timestamp'.
    const historicalPath = 'weather/historical/station1'; 
    const historicalRef = ref(database, historicalPath);
    
    console.log(`[HistoricalDataSection] Fetching historical data from: ${historicalRef.toString()}`);
    console.log(`[HistoricalDataSection] Date range: From ${dateRange.from.toISOString()} To ${dateRange.to.toISOString()}`);
    console.log(`[HistoricalDataSection] Timestamps: Start ${dateRange.from.getTime()}, End ${dateRange.to.getTime()}`);

    try {
      const q = query(
        historicalRef,
        orderByChild('timestamp'), 
        startAt(dateRange.from.getTime()),
        endAt(dateRange.to.getTime())
      );
      
      const snapshot: DataSnapshot = await get(q);
      console.log('[HistoricalDataSection] Fetched historical data snapshot:', snapshot);
      
      if (snapshot.exists()) {
        const rawData = snapshot.val();
        console.log('[HistoricalDataSection] Raw historical data value:', rawData);
        // Firebase returns an object when data is fetched this way. Convert it to an array.
        // This assumes each child under 'weather/historical/station1' is a WeatherDataPoint.
        const processedData: WeatherDataPoint[] = Object.values(rawData).filter(Boolean) as WeatherDataPoint[];
        
        // Additional check for data structure if needed
        if (processedData.length > 0 && typeof processedData[0].timestamp !== 'number') {
            console.warn('[HistoricalDataSection] Timestamp in fetched data is not a number. This might cause issues. Data:', processedData[0]);
        }

        setHistoricalData(processedData.sort((a, b) => a.timestamp - b.timestamp)); // Ensure data is sorted by time
        console.log('[HistoricalDataSection] Processed historical data points:', processedData.length);
      } else {
        setHistoricalData([]);
        console.warn(`[HistoricalDataSection] No historical data found for the selected range at path: ${historicalPath}`);
      }
    } catch (error) {
      console.error("[HistoricalDataSection] Firebase historical data fetching error:", error);
      setHistoricalData([]); 
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);


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
          <Button onClick={fetchHistoricalData} disabled={isLoading || !dateRange?.from || !dateRange?.to} className="w-full md:w-auto">
            {isLoading ? 'Loading Data...' : 'Load Data'}
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
