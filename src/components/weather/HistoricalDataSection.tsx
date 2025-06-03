
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
import { ref, get, type DataSnapshot } from "firebase/database";
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { transformRawDataToWeatherDataPoint } from '@/lib/utils';
import { CloudRain, Thermometer, Droplets, SunDim, Wind, Gauge, ShieldCheck } from 'lucide-react';

// Metrics available for selection in the historical chart's DataSelector
const HISTORICAL_AVAILABLE_METRICS: { key: MetricKey; name: string }[] = [
  { key: 'temperature', name: 'Temperature' },
  { key: 'humidity', name: 'Humidity' },
  { key: 'precipitation', name: 'Precipitation' }, // String-based, won't plot as line, but can be in tooltip
  { key: 'aqiPpm', name: 'AQI (ppm)' },
  { key: 'lux', name: 'Light (Lux)' },
  { key: 'pressure', name: 'Pressure' },
];

// Full configuration for all possible metrics (used by chart and potentially other components)
const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'hsl(var(--chart-1))', healthyMin: 0, healthyMax: 35 },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'hsl(var(--chart-2))', healthyMin: 30, healthyMax: 70 },
  precipitation: { name: 'Precipitation', unit: '', Icon: CloudRain, color: 'hsl(var(--chart-3))', isString: true },
  airQuality: { name: 'Air Quality', unit: '', Icon: ShieldCheck, color: 'hsl(var(--chart-4))', isString: true }, // String based, used in realtime
  aqiPpm: { name: 'AQI (ppm)', unit: 'ppm', Icon: Wind, color: 'hsl(var(--chart-5))', healthyMin: 0, healthyMax: 300 },
  lux: { name: 'Light Level', unit: 'lux', Icon: SunDim, color: 'hsl(30, 80%, 55%)' },
  pressure: { name: 'Pressure', unit: 'hPa', Icon: Gauge, color: 'hsl(120, 60%, 45%)', healthyMin: 980, healthyMax: 1040 },
};

interface HistoricalDataSectionProps {
  onChartPointClick?: (point: WeatherDataPoint) => void;
  onChartRangeSelect?: (points: WeatherDataPoint[]) => void;
}

const HistoricalDataSection: FC<HistoricalDataSectionProps> = ({ onChartPointClick, onChartRangeSelect }) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(startOfDay(new Date()), 7),
    to: endOfDay(new Date()),
  });
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['temperature', 'humidity', 'aqiPpm']);
  const [allFetchedData, setAllFetchedData] = useState<WeatherDataPoint[]>([]);
  const [displayedData, setDisplayedData] = useState<WeatherDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const firebaseDataPath = 'devices/TGkMhLL4k4ZFBwgOyRVNKe5mTQq1/records/'; 

  const fetchAllHistoricalData = useCallback(async () => {
    setIsLoading(true);
    setAllFetchedData([]);
    setDisplayedData([]);
    console.log(`[HistoricalDataSection] Attempting to fetch all historical data from Firebase path: ${firebaseDataPath}`);

    try {
      const dataRef = ref(database, firebaseDataPath);
      const snapshot: DataSnapshot = await get(dataRef);

      if (snapshot.exists()) {
        const rawDataContainer = snapshot.val();
        console.log('[HistoricalDataSection] Raw historical data container from Firebase:', JSON.parse(JSON.stringify(rawDataContainer)));

        if (typeof rawDataContainer !== 'object' || rawDataContainer === null) {
          console.warn('[HistoricalDataSection] Fetched data is not an object or is null. Cannot process.');
          setAllFetchedData([]);
          setIsLoading(false);
          return;
        }

        const recordsArray: [string, RawFirebaseDataPoint][] = Object.entries(rawDataContainer);
        console.log(`[HistoricalDataSection] Number of raw records fetched (Object.entries): ${recordsArray.length}`);

        const processedData: WeatherDataPoint[] = recordsArray
          .map(([key, rawPoint]) => {
            console.log(`[HistoricalDataSection] Processing raw point with key: ${key}`);
            return transformRawDataToWeatherDataPoint(rawPoint as RawFirebaseDataPoint, key);
          })
          .filter((point): point is WeatherDataPoint => {
            const isValid = point !== null;
            if (!isValid) console.warn('[HistoricalDataSection] A point was filtered out after transformation (returned null).');
            return isValid;
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        console.log(`[HistoricalDataSection] Number of successfully processed and sorted data points: ${processedData.length}`);
        if (processedData.length > 0) {
            console.log('[HistoricalDataSection] First processed point:', JSON.parse(JSON.stringify(processedData[0])));
            console.log('[HistoricalDataSection] Last processed point:', JSON.parse(JSON.stringify(processedData[processedData.length - 1])));
        }
        setAllFetchedData(processedData);
      } else {
        console.warn(`[HistoricalDataSection] No historical data found at Firebase path: ${firebaseDataPath}`);
        setAllFetchedData([]);
      }
    } catch (error) {
      console.error("[HistoricalDataSection] Firebase historical data fetching error:", error);
      setAllFetchedData([]);
    } finally {
      setIsLoading(false);
    }
  }, [firebaseDataPath]);

  const filterDataByDateRange = useCallback(() => {
    if (isLoading) {
      console.log('[HistoricalDataSection] filterDataByDateRange skipped: still loading all data.');
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      console.log('[HistoricalDataSection] filterDataByDateRange skipped: date range not fully defined.');
      setDisplayedData([]);
      return;
    }
    if (allFetchedData.length === 0) {
      console.log('[HistoricalDataSection] filterDataByDateRange: no data in allFetchedData to filter.');
      setDisplayedData([]);
      return;
    }

    const fromTime = startOfDay(dateRange.from).getTime();
    const toTime = endOfDay(dateRange.to).getTime();

    console.log(`[HistoricalDataSection] Filtering data for date range: ${new Date(fromTime).toISOString()} to ${new Date(toTime).toISOString()}`);

    const filtered = allFetchedData.filter(point => {
      const pointTime = point.timestamp;
      return pointTime >= fromTime && pointTime <= toTime;
    });

    setDisplayedData(filtered);
    console.log(`[HistoricalDataSection] Filtering complete. Displaying ${filtered.length} of ${allFetchedData.length} total fetched points.`);
    if(filtered.length > 0) {
        console.log('[HistoricalDataSection] First displayed point:', JSON.parse(JSON.stringify(filtered[0])));
        console.log('[HistoricalDataSection] Last displayed point:', JSON.parse(JSON.stringify(filtered[filtered.length - 1])));
    } else if (allFetchedData.length > 0) {
        console.warn('[HistoricalDataSection] No data points matched the current date range.');
    }

  }, [allFetchedData, dateRange, isLoading]);

  useEffect(() => {
    fetchAllHistoricalData();
  }, [fetchAllHistoricalData]);

  useEffect(() => {
    filterDataByDateRange();
  }, [dateRange, allFetchedData, filterDataByDateRange]);


  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">Historical Data Analysis</h2>
      <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <Label htmlFor="date-range-picker" className="text-sm font-medium text-muted-foreground mb-1 block">Select Date Range:</Label>
            <DateRangePicker onDateChange={setDateRange} initialRange={dateRange} id="date-range-picker"/>
          </div>
          <Button onClick={fetchAllHistoricalData} disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? 'Loading...' : 'Refresh All Data'}
          </Button>
        </div>
         <p className="text-xs text-muted-foreground">
            Data is fetched from Firebase path: `{firebaseDataPath}`.
          </p>
        <DataSelector
          availableMetrics={HISTORICAL_AVAILABLE_METRICS}
          selectedMetrics={selectedMetrics}
          onSelectionChange={setSelectedMetrics}
        />
      </div>
      <div className="mt-6">
        <WeatherChart
          data={displayedData}
          selectedMetrics={selectedMetrics}
          metricConfigs={METRIC_CONFIGS}
          isLoading={isLoading && allFetchedData.length === 0}
          onPointClick={onChartPointClick}
          onRangeSelect={onChartRangeSelect}
        />
      </div>
    </section>
  );
};

export default HistoricalDataSection;

