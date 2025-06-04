
"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import DateRangePicker from './DateRangePicker';
import DataSelector from './DataSelector';
import type { DateRange } from 'react-day-picker';
import { subDays, format, getISOWeek, getYear } from 'date-fns';
import type { WeatherDataPoint, MetricKey, MetricConfig, RawFirebaseDataPoint } from '@/types/weather';
import { database } from '@/lib/firebase';
import { ref, get, type DataSnapshot } from "firebase/database";
import { Label as ShadcnLabel } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { transformRawDataToWeatherDataPoint } from '@/lib/utils';
import { CloudRain, Thermometer, Droplets, SunDim, Wind, Gauge, ShieldCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';

const WeatherChart = dynamic(() => import('./WeatherChart'), {
  ssr: false,
  loading: () => <div className="mt-6"><Skeleton className="h-[550px] w-full" /></div>,
});


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

type ChartType = 'line' | 'bar' | 'scatter';
type AggregationPeriod = 'daily' | 'weekly' | 'monthly';
type ChartAggregationMode = AggregationPeriod | 'raw';


interface AggregatedDataPoint {
  timestamp: number;
  timestampDisplay: string;
  aggregationPeriod?: AggregationPeriod;
  [metricKey: string]: number | string | undefined | AggregationPeriod; // Will hold general values for line/bar
  // For scatter chart with aggregation, specific fields like temperature_avg, temperature_stdDev
}

interface HistoricalDataSectionProps {
  onChartPointClick?: (point: WeatherDataPoint) => void;
}

const calculateStandardDeviation = (values: number[]): number => {
  if (values.length <= 1) return 0; // Std dev is 0 or undefined for single/no point
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const HistoricalDataSection: FC<HistoricalDataSectionProps> = ({ onChartPointClick }) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [startTime, setStartTime] = useState<string>("00:00");
  const [endTime, setEndTime] = useState<string>("23:59");
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['temperature', 'humidity']);
  const [allFetchedData, setAllFetchedData] = useState<WeatherDataPoint[]>([]);
  const [displayedData, setDisplayedData] = useState<WeatherDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('line');
  const [aggregationType, setAggregationType] = useState<ChartAggregationMode>('raw');
  const [showMinMaxLines, setShowMinMaxLines] = useState<boolean>(false);


  const firebaseDataPath = 'devices/TGkMhLL4k4ZFBwgOyRVNKe5mTQq1/records/';

  useEffect(() => {
    setDateRange({
      from: subDays(new Date(), 7),
      to: new Date(),
    });
  }, []);

  const fetchAllHistoricalData = useCallback(async () => {
    setIsLoading(true);
    try {
      const dataRef = ref(database, firebaseDataPath);
      const snapshot: DataSnapshot = await get(dataRef);

      if (snapshot.exists()) {
        const rawDataContainer = snapshot.val();
        if (typeof rawDataContainer !== 'object' || rawDataContainer === null) {
          setAllFetchedData([]);
        } else {
          const recordsArray: [string, RawFirebaseDataPoint][] = Object.entries(rawDataContainer);
          const processedData: WeatherDataPoint[] = recordsArray
            .map(([key, rawPoint]) => transformRawDataToWeatherDataPoint(rawPoint as RawFirebaseDataPoint, key))
            .filter((point): point is WeatherDataPoint => point !== null)
            .sort((a, b) => a.timestamp - b.timestamp);
          setAllFetchedData(processedData);
        }
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
    if (!dateRange?.from || !dateRange?.to) {
      setDisplayedData([]);
      return;
    }
    if (allFetchedData.length === 0 && !isLoading) {
      setDisplayedData([]);
      return;
    }

    const startDate = dateRange.from;
    const [startH, startM] = startTime.split(':').map(Number);
    const fromTimestamp = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startH, startM, 0, 0);

    const endDate = dateRange.to;
    const [endH, endM] = endTime.split(':').map(Number);
    const toTimestamp = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), endH, endM, 59, 999);

    const filtered = allFetchedData.filter(point => {
      const pointTime = point.timestamp;
      return pointTime >= fromTimestamp && pointTime <= toTimestamp;
    });

    setDisplayedData(filtered);

  }, [allFetchedData, dateRange, startTime, endTime, isLoading]);

  useEffect(() => {
    fetchAllHistoricalData();
  }, [fetchAllHistoricalData]);

  useEffect(() => {
    if (dateRange && allFetchedData.length > 0) {
      filterDataByDateRange();
    } else if (dateRange && !isLoading) {
      setDisplayedData([]);
    }
  }, [dateRange, allFetchedData, filterDataByDateRange, startTime, endTime, isLoading]);
  
  const handleChartTypeChange = (newChartType: ChartType) => {
    setSelectedChartType(newChartType);
    if (newChartType === 'bar' && aggregationType === 'raw') {
      setAggregationType('daily'); 
    }
     if (newChartType === 'scatter' && aggregationType === 'raw') {
      // For scatter, if raw, it's fine. If user wants aggregated scatter, they'll pick aggregation.
      // Default to daily if previously on a non-raw bar/line perhaps.
      // setAggregationType('daily'); // Or keep as 'raw'
    }
  };

  const isAggregationApplicable = selectedChartType === 'line' || selectedChartType === 'bar' || selectedChartType === 'scatter';
  const isActuallyAggregated = isAggregationApplicable && aggregationType !== 'raw';

  const chartData = useMemo(() => {
    if (!displayedData || displayedData.length === 0) {
      return [];
    }

    if (isActuallyAggregated) {
      const currentAggregationPeriod = aggregationType as AggregationPeriod; 
      const groupedData: Record<string, WeatherDataPoint[]> = {};
      displayedData.forEach(point => {
        let key = '';
        const pointDate = new Date(point.timestamp);
        if (currentAggregationPeriod === 'daily') {
          key = format(pointDate, 'yyyy-MM-dd');
        } else if (currentAggregationPeriod === 'weekly') {
          const weekYear = getYear(pointDate);
          const weekNumber = getISOWeek(pointDate);
          key = `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;
        } else if (currentAggregationPeriod === 'monthly') {
          key = format(pointDate, 'yyyy-MM');
        }

        if (!groupedData[key]) {
          groupedData[key] = [];
        }
        groupedData[key].push(point);
      });

      return Object.entries(groupedData).map(([key, pointsInGroup]) => {
        const aggregatedPoint: AggregatedDataPoint = {
          timestamp: pointsInGroup[0].timestamp, 
          timestampDisplay: '', 
          aggregationPeriod: currentAggregationPeriod,
        };

        if (currentAggregationPeriod === 'daily') {
          aggregatedPoint.timestampDisplay = format(new Date(pointsInGroup[0].timestamp), 'MMM dd');
        } else if (currentAggregationPeriod === 'weekly') {
           const dateFromKey = new Date(pointsInGroup[0].timestamp); 
           aggregatedPoint.timestampDisplay = `W${getISOWeek(dateFromKey)}, ${getYear(dateFromKey)}`;
        } else if (currentAggregationPeriod === 'monthly') {
          aggregatedPoint.timestampDisplay = format(new Date(pointsInGroup[0].timestamp), 'MMM yyyy');
        }


        selectedMetrics.forEach(metricKey => {
          const config = METRIC_CONFIGS[metricKey];
          if (config && !config.isString) { 
            const values = pointsInGroup.map(p => p[metricKey] as number).filter(v => typeof v === 'number' && isFinite(v));
            if (values.length > 0) {
              const average = values.reduce((sum, val) => sum + val, 0) / values.length;
              if (selectedChartType === 'scatter') {
                aggregatedPoint[`${metricKey}_avg`] = average;
                aggregatedPoint[`${metricKey}_stdDev`] = calculateStandardDeviation(values);
                aggregatedPoint[`${metricKey}_count`] = values.length;
              } else {
                aggregatedPoint[metricKey] = average;
              }
            } else {
               if (selectedChartType === 'scatter') {
                aggregatedPoint[`${metricKey}_avg`] = undefined;
                aggregatedPoint[`${metricKey}_stdDev`] = undefined;
                aggregatedPoint[`${metricKey}_count`] = 0;
              } else {
                aggregatedPoint[metricKey] = undefined; 
              }
            }
          } else if (config && config.isString) { 
             // For string metrics, usually for bar chart categories or simple display.
             // For scatter, less relevant unless used as a categorical axis.
             // For simplicity, take the first one.
            aggregatedPoint[metricKey] = pointsInGroup[0]?.[metricKey];
             if (selectedChartType === 'scatter') { // Also ensure _avg, _stdDev, _count exist for consistency for scatter
                aggregatedPoint[`${metricKey}_avg`] = pointsInGroup[0]?.[metricKey]; // Use string value as "avg"
                aggregatedPoint[`${metricKey}_stdDev`] = undefined; // StdDev not applicable for strings
                aggregatedPoint[`${metricKey}_count`] = pointsInGroup.length;
             }
          }
        });
        return aggregatedPoint;
      }).sort((a, b) => a.timestamp - b.timestamp);
    }
    
    return displayedData.map(point => ({
        ...point,
        // Ensure _stdDev and _count fields exist for raw scatter for consistent data structure if needed by chart
        // though they won't be used for sizing.
        ...(selectedChartType === 'scatter' && !isActuallyAggregated && selectedMetrics.reduce((acc, metricKey) => {
            acc[`${metricKey}_stdDev`] = undefined;
            acc[`${metricKey}_count`] = 1;
            return acc;
        }, {} as Record<string, any>))
    }));
  }, [displayedData, selectedChartType, aggregationType, selectedMetrics, isActuallyAggregated]);

  const minMaxReferenceData = useMemo(() => {
    if (!showMinMaxLines || chartData.length === 0) {
      return undefined;
    }
    const result: Record<string, { minValue: number; maxValue: number }> = {};
    selectedMetrics.forEach(metricKey => {
      const config = METRIC_CONFIGS[metricKey];
      if (config && !config.isString) {
        const values = chartData.map(p => {
          if (selectedChartType === 'scatter' && isActuallyAggregated) {
            return p[`${metricKey}_avg`] as number;
          }
          return p[metricKey] as number;
        }).filter(v => typeof v === 'number' && isFinite(v));
        
        if (values.length > 0) {
          result[metricKey] = {
            minValue: Math.min(...values),
            maxValue: Math.max(...values),
          };
        }
      }
    });
    return result;
  }, [showMinMaxLines, chartData, selectedMetrics, selectedChartType, isActuallyAggregated, METRIC_CONFIGS]);


  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">Historical Data Analysis</h2>
      <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <ShadcnLabel htmlFor="date-range-picker" className="text-sm font-medium text-muted-foreground mb-1 block">Date Range:</ShadcnLabel>
              <DateRangePicker onDateChange={setDateRange} initialRange={dateRange} id="date-range-picker"/>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                    <ShadcnLabel htmlFor="start-time-hist" className="text-sm font-medium text-muted-foreground mb-1 block">Start Time:</ShadcnLabel>
                    <Input
                        type="time"
                        id="start-time-hist"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full"
                    />
                </div>
                <div>
                    <ShadcnLabel htmlFor="end-time-hist" className="text-sm font-medium text-muted-foreground mb-1 block">End Time:</ShadcnLabel>
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
        <div className="mt-4 flex flex-col sm:flex-row items-end gap-4">
          <div>
            <ShadcnLabel htmlFor="chart-type-select" className="text-sm font-medium text-muted-foreground mb-1 block">Chart Type:</ShadcnLabel>
            <Select value={selectedChartType} onValueChange={(value) => handleChartTypeChange(value as ChartType)}>
              <SelectTrigger id="chart-type-select" className="w-full sm:w-auto sm:min-w-[150px]">
                <SelectValue placeholder="Select chart type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="scatter">Scatter Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAggregationApplicable && (
            <div>
              <ShadcnLabel htmlFor="aggregation-type-select" className="text-sm font-medium text-muted-foreground mb-1 block">Aggregation:</ShadcnLabel>
              <Select 
                value={aggregationType} 
                onValueChange={(value) => setAggregationType(value as ChartAggregationMode)}
                disabled={selectedChartType === 'scatter' && aggregationType === 'raw' && !isAggregationApplicable } /* Example complex disable, adjust as needed */
              >
                <SelectTrigger id="aggregation-type-select" className="w-full sm:w-auto sm:min-w-[150px]">
                  <SelectValue placeholder="Select aggregation" />
                </SelectTrigger>
                <SelectContent>
                  { (selectedChartType === 'line' || (selectedChartType === 'scatter')) && <SelectItem value="raw">Raw Data</SelectItem> }
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {selectedChartType === 'line' && (
            <div className="flex items-center space-x-2 mt-2 sm:mt-0 sm:self-end pb-1">
              <Checkbox
                id="show-min-max-lines"
                checked={showMinMaxLines}
                onCheckedChange={(checked) => setShowMinMaxLines(Boolean(checked))}
                aria-label="Show Min/Max Lines"
              />
              <ShadcnLabel
                htmlFor="show-min-max-lines"
                className="text-sm font-medium text-muted-foreground cursor-pointer"
              >
                Show Min/Max Lines
              </ShadcnLabel>
            </div>
          )}
        </div>
      </div>
      <div className="mt-6">
        <WeatherChart
          data={chartData}
          selectedMetrics={selectedMetrics}
          metricConfigs={METRIC_CONFIGS}
          isLoading={isLoading && allFetchedData.length === 0 && chartData.length === 0}
          onPointClick={ ((selectedChartType === 'line' && aggregationType === 'raw') || (selectedChartType === 'scatter' && aggregationType === 'raw')) ? onChartPointClick : undefined }
          chartType={selectedChartType}
          isAggregated={isActuallyAggregated}
          showMinMaxLines={showMinMaxLines && selectedChartType === 'line'}
          minMaxReferenceData={minMaxReferenceData}
        />
      </div>
    </section>
  );
};

export default HistoricalDataSection;

