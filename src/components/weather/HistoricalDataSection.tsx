
"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import DateRangePicker from './DateRangePicker';
import DataSelector from './DataSelector';
import WeatherChart from './WeatherChart';
import type { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import type { WeatherDataPoint, MetricKey, MetricConfig, RawFirebaseDataPoint } from '@/types/weather';
import { database } from '@/lib/firebase';
import { ref, get, type DataSnapshot } from "firebase/database";
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { transformRawDataToWeatherDataPoint } from '@/lib/utils';
import { CloudRain, Thermometer, Droplets, SunDim, Wind, Gauge, ShieldCheck } from 'lucide-react';

const HISTORICAL_AVAILABLE_METRICS: { key: MetricKey; name: string }[] = [
  { key: 'temperature', name: 'Temperature' },
  { key: 'humidity', name: 'Humidity' },
  { key: 'aqiPpm', name: 'AQI (ppm)' },
  { key: 'lux', name: 'Light (Lux)' },
  { key: 'pressure', name: 'Pressure' },
];

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'hsl(var(--chart-1))', healthyMin: 0, healthyMax: 35 },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'hsl(var(--chart-2))', healthyMin: 30, healthyMax: 70 },
  precipitation: { name: 'Precipitation', unit: '', Icon: CloudRain, color: 'hsl(var(--chart-3))', isString: true },
  airQuality: { name: 'Air Quality', unit: '', Icon: ShieldCheck, color: 'hsl(var(--chart-4))', isString: true },
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
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [startTime, setStartTime] = useState<string>("00:00");
  const [endTime, setEndTime] = useState<string>("23:59");
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['temperature', 'humidity']);
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
        if (typeof rawDataContainer !== 'object' || rawDataContainer === null) {
          setAllFetchedData([]);
          setIsLoading(false);
          return;
        }
        const recordsArray: [string, RawFirebaseDataPoint][] = Object.entries(rawDataContainer);
        const processedData: WeatherDataPoint[] = recordsArray
          .map(([key, rawPoint]) => transformRawDataToWeatherDataPoint(rawPoint as RawFirebaseDataPoint, key))
          .filter((point): point is WeatherDataPoint => point !== null)
          .sort((a, b) => a.timestamp - b.timestamp);
        setAllFetchedData(processedData);
      } else {
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
    if (isLoading) return;
    if (!dateRange?.from || !dateRange?.to) {
      setDisplayedData([]);
      return;
    }
    if (allFetchedData.length === 0) {
      setDisplayedData([]);
      return;
    }

    const startDate = dateRange.from;
    const [startH, startM] = startTime.split(':').map(Number);
    const fromTimestamp = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startH, startM, 0, 0);

    const endDate = dateRange.to;
    const [endH, endM] = endTime.split(':').map(Number);
    const toTimestamp = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), endH, endM, 59, 999);
    
    console.log(`[HistoricalDataSection] Filtering data for UTC datetime range: ${new Date(fromTimestamp).toISOString()} to ${new Date(toTimestamp).toISOString()}`);

    const filtered = allFetchedData.filter(point => {
      const pointTime = point.timestamp;
      return pointTime >= fromTimestamp && pointTime <= toTimestamp;
    });

    setDisplayedData(filtered);
    console.log(`[HistoricalDataSection] Filtering complete. Displaying ${filtered.length} of ${allFetchedData.length} total fetched points.`);

  }, [allFetchedData, dateRange, isLoading, startTime, endTime]);

  useEffect(() => {
    fetchAllHistoricalData();
  }, [fetchAllHistoricalData]);

  useEffect(() => {
    filterDataByDateRange();
  }, [dateRange, allFetchedData, filterDataByDateRange, startTime, endTime]);

  const handleUseAllDataForForecast = () => {
    if (onChartRangeSelect) {
      if (displayedData.length > 0) {
        onChartRangeSelect(displayedData);
      } else {
        onChartRangeSelect([]);
      }
    }
  };

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">Historical Data Analysis</h2>
      <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="date-range-picker" className="text-sm font-medium text-muted-foreground mb-1 block">Select Date Range:</Label>
              <DateRangePicker onDateChange={setDateRange} initialRange={dateRange} id="date-range-picker"/>
            </div>
             <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                    <Label htmlFor="start-time-hist" className="text-sm font-medium text-muted-foreground mb-1 block">Start Time:</Label>
                    <Input 
                        type="time" 
                        id="start-time-hist" 
                        value={startTime} 
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full"
                    />
                </div>
                <div>
                    <Label htmlFor="end-time-hist" className="text-sm font-medium text-muted-foreground mb-1 block">End Time:</Label>
                    <Input 
                        type="time" 
                        id="end-time-hist" 
                        value={endTime} 
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full"
                    />
                </div>
            </div>
          </div>
          <Button onClick={fetchAllHistoricalData} disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? 'Loading...' : 'Refresh All Data'}
          </Button>
        </div>
         <p className="text-xs text-muted-foreground">
            Data is fetched from Firebase path: `{firebaseDataPath}`. Time selection applies to the chosen date range.
          </p>
        <DataSelector
          availableMetrics={HISTORICAL_AVAILABLE_METRICS}
          selectedMetrics={selectedMetrics}
          onSelectionChange={setSelectedMetrics}
        />
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-start gap-4">
          {/* Removed Chart Type Selector and its Label */}
          <Button onClick={handleUseAllDataForForecast} className="w-full sm:w-auto" disabled={isLoading && displayedData.length === 0}>
            Use All Displayed Data for AI Forecast
          </Button>
        </div>
      </div>
      <div className="mt-6">
        <WeatherChart
          data={displayedData}
          selectedMetrics={selectedMetrics}
          metricConfigs={METRIC_CONFIGS}
          isLoading={isLoading && allFetchedData.length === 0}
          onPointClick={onChartPointClick}
        />
      </div>
    </section>
  );
};

export default HistoricalDataSection;
