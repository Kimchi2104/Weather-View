
"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import DateRangePicker from './DateRangePicker';
import DataSelector from './DataSelector';
import WeatherChart from './WeatherChart';
import type { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import type { WeatherDataPoint, MetricKey, MetricConfig, RawFirebaseDataPoint } from '@/types/weather';
import { database } from '@/lib/firebase';
import { ref, get, type DataSnapshot, query, orderByChild, limitToLast } from "firebase/database"; // Keep query, orderByChild, limitToLast for future potential use or if structure changes
import { CloudRain, Thermometer, Droplets, SunDim, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { transformRawDataToWeatherDataPoint } from '@/lib/utils';

const AVAILABLE_METRICS: { key: MetricKey; name: string }[] = [
  { key: 'temperature', name: 'Temperature' },
  { key: 'humidity', name: 'Humidity' },
  { key: 'precipitation', name: 'Precipitation' },
  { key: 'airQualityIndex', name: 'AQI' },
  { key: 'lux', name: 'Light (Lux)' },
];

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'hsl(var(--chart-1))' },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'hsl(var(--chart-2))' },
  precipitation: { name: 'Precipitation', unit: 'val', Icon: CloudRain, color: 'hsl(var(--chart-3))' }, // Unit changed as rainAnalog is a raw value
  airQualityIndex: { name: 'Air Quality Index', unit: 'AQI', Icon: Wind, color: 'hsl(var(--chart-4))' },
  lux: { name: 'Light Level', unit: 'lux', Icon: SunDim, color: 'hsl(var(--chart-5))' },
};

const HistoricalDataSection: FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(startOfDay(new Date()), 7),
    to: endOfDay(new Date()),
  });
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['temperature', 'humidity']);
  const [allFetchedData, setAllFetchedData] = useState<WeatherDataPoint[]>([]);
  const [displayedData, setDisplayedData] = useState<WeatherDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // TODO: IMPORTANT! Update this path to the correct location of your weather data in Firebase.
  // This path should point to the parent node containing all your timestamped records.
  // Example: if your data is at /myWeatherStation/logs/, use 'myWeatherStation/logs'.
  const firebaseDataPath = 'allWeatherData'; // <<< --- USER NEEDS TO VERIFY AND CHANGE THIS

  const fetchAllHistoricalData = useCallback(async () => {
    setIsLoading(true);
    console.log(`[HistoricalDataSection] Fetching all historical data from: ${firebaseDataPath}`);
    
    try {
      const dataRef = ref(database, firebaseDataPath);
      const snapshot: DataSnapshot = await get(dataRef);
      
      if (snapshot.exists()) {
        const rawDataContainer = snapshot.val(); // This will be an object like {'2025-06-03_16:08:39': {...}, ...}
        console.log('[HistoricalDataSection] Raw historical data container:', rawDataContainer);

        const processedData: WeatherDataPoint[] = Object.values(rawDataContainer as Record<string, RawFirebaseDataPoint>)
          .map(transformRawDataToWeatherDataPoint)
          .filter((point): point is WeatherDataPoint => point !== null) // Remove nulls from failed transformations
          .sort((a, b) => a.timestamp - b.timestamp); // Ensure data is sorted by time

        setAllFetchedData(processedData);
        console.log('[HistoricalDataSection] Processed all historical data points:', processedData.length);
      } else {
        setAllFetchedData([]);
        console.warn(`[HistoricalDataSection] No historical data found at path: ${firebaseDataPath}`);
      }
    } catch (error) {
      console.error("[HistoricalDataSection] Firebase historical data fetching error:", error);
      setAllFetchedData([]); 
    } finally {
      setIsLoading(false);
    }
  }, [firebaseDataPath]);

  const filterDataByDateRange = useCallback(() => {
    if (!dateRange?.from || !dateRange?.to) {
      setDisplayedData([]);
      return;
    }
    if (allFetchedData.length === 0) {
      setDisplayedData([]);
      return;
    }

    const fromTime = dateRange.from.getTime();
    const toTime = dateRange.to.getTime();

    const filtered = allFetchedData.filter(point => 
      point.timestamp >= fromTime && point.timestamp <= toTime
    );
    setDisplayedData(filtered);
    console.log(`[HistoricalDataSection] Filtered data for range. Displaying ${filtered.length} of ${allFetchedData.length} points.`);

  }, [allFetchedData, dateRange]);

  // Fetch all data once on component mount or if path changes
  useEffect(() => {
    fetchAllHistoricalData();
  }, [fetchAllHistoricalData]);

  // Re-filter data when dateRange or allFetchedData changes
  useEffect(() => {
    if (!isLoading) { // Only filter if not currently loading all data
      filterDataByDateRange();
    }
  }, [dateRange, allFetchedData, isLoading, filterDataByDateRange]);


  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">Historical Data Analysis</h2>
      <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <Label htmlFor="date-range-picker" className="text-sm font-medium text-muted-foreground mb-1 block">Select Date Range:</Label>
            <DateRangePicker onDateChange={setDateRange} initialRange={dateRange} id="date-range-picker"/>
          </div>
          {/* The button now re-triggers filtering, not re-fetching all data unless needed.
              Consider if a "Refresh All Data" button is needed if data updates frequently in this historical path.
              For now, data is fetched once.
           */}
          <Button onClick={filterDataByDateRange} disabled={isLoading || !dateRange?.from || !dateRange?.to || allFetchedData.length === 0} className="w-full md:w-auto">
            {isLoading ? 'Loading...' : (allFetchedData.length === 0 ? 'No Data Loaded' : 'Apply Date Filter')}
          </Button>
        </div>
         <p className="text-xs text-muted-foreground">
            Ensure the Firebase path in the code (`HistoricalDataSection.tsx`) points to your data collection. Currently: `{firebaseDataPath}`.
          </p>
        <DataSelector
          availableMetrics={AVAILABLE_METRICS}
          selectedMetrics={selectedMetrics}
          onSelectionChange={setSelectedMetrics}
        />
      </div>
      <div className="mt-6">
        <WeatherChart 
          data={displayedData} 
          selectedMetrics={selectedMetrics} 
          metricConfigs={METRIC_CONFIGS}
          isLoading={isLoading && allFetchedData.length === 0} // Show loading skeleton only if initial full load is happening
        />
      </div>
    </section>
  );
};

export default HistoricalDataSection;
