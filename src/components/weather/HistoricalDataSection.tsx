
"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import DateRangePicker from './DateRangePicker';
import DataSelector from './DataSelector';
import type { DateRange } from 'react-day-picker';
import { subDays, format, getISOWeek, getYear, startOfHour, endOfHour, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { WeatherDataPoint, MetricKey, MetricConfig, RawFirebaseDataPoint, AggregatedDataPoint, DetailModalData as DetailModalDataTypeFromType, ChartType } from '@/types/weather';
import { database } from '@/lib/firebase';
import { ref, get, type DataSnapshot } from "firebase/database";
import { Label as ShadcnLabel } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { transformRawDataToWeatherDataPoint, formatTimestampToDdMmHhMmUTC, formatTimestampToFullUTC } from '@/lib/utils';
import { CloudRain, Thermometer, Droplets, SunDim, Wind, Gauge, ShieldCheck, Sun, Moon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import DetailedDistributionModal from './DetailedDistributionModal';
import { useTheme } from 'next-themes';


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
  { key: 'sunriseSunset', name: 'Day/Night' },
];

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'hsl(var(--chart-1))', healthyMin: 0, healthyMax: 35 },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'hsl(var(--chart-2))', healthyMin: 30, healthyMax: 70 },
  precipitation: { name: 'Precipitation', unit: '', Icon: CloudRain, color: 'hsl(var(--chart-3))', isString: true },
  airQuality: { name: 'Air Quality', unit: '', Icon: ShieldCheck, color: 'hsl(var(--chart-4))', isString: true },
  aqiPpm: { name: 'AQI (ppm)', unit: 'ppm', Icon: Wind, color: 'hsl(var(--chart-5))', healthyMin: 0, healthyMax: 300 },
  lux: { name: 'Light Level', unit: 'lux', Icon: SunDim, color: 'hsl(30, 80%, 55%)' },
  pressure: { name: 'Pressure', unit: 'hPa', Icon: Gauge, color: 'hsl(120, 60%, 45%)', healthyMin: 980, healthyMax: 1040 },
  sunriseSunset: { name: 'Day/Night', unit: '', Icon: Sun, color: 'hsl(45, 100%, 50%)', isString: true }, // Icon can be dynamic based on value (Sun/Moon)
};

type AggregationPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';
type ChartAggregationMode = AggregationPeriod | 'raw';

interface HistoricalDataSectionProps {
  onChartPointClickForAI?: (point: WeatherDataPoint | null) => void;
}

const calculateStandardDeviation = (values: number[]): number => {
  if (!values || values.length === 0) return 0;
  const validValues = values.filter(v => typeof v === 'number' && isFinite(v));
  if (validValues.length <= 1) return 0;

  const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  if (!isFinite(mean)) return 0;

  const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
  if (isNaN(variance) || !isFinite(variance)) return 0;

  const stdDev = Math.sqrt(variance);
  return isNaN(stdDev) || !isFinite(stdDev) ? 0 : stdDev;
};


const HistoricalDataSection: FC<HistoricalDataSectionProps> = ({ onChartPointClickForAI }) => {
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

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailModalData, setDetailModalData] = useState<DetailModalDataTypeFromType | null>(null);

  const { theme } = useTheme();
  const isAuraGlassTheme = theme === 'aura-glass';
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

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
     if (newChartType !== 'scatter' && aggregationType === 'raw') { // Violin removed
        setAggregationType('daily');
    } else if (newChartType === 'scatter' && aggregationType === 'raw') {
      // Scatter can be raw
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
        if (currentAggregationPeriod === 'hourly') {
          key = format(pointDate, 'yyyy-MM-dd HH');
        } else if (currentAggregationPeriod === 'daily') {
          key = format(pointDate, 'yyyy-MM-dd');
        } else if (currentAggregationPeriod === 'weekly') {
          key = getYear(pointDate) + '-W' + String(getISOWeek(pointDate)).padStart(2, '0');
        } else if (currentAggregationPeriod === 'monthly') {
          key = format(pointDate, 'yyyy-MM');
        }

        if (!groupedData[key]) {
          groupedData[key] = [];
        }
        groupedData[key].push(point);
      });

      const aggregatedResult: AggregatedDataPoint[] = Object.entries(groupedData).map(([groupKey, pointsInGroup]) => {
        const firstPointDate = new Date(pointsInGroup[0].timestamp);
        const aggregatedPoint: AggregatedDataPoint = {
          timestamp: firstPointDate.getTime(),
          timestampDisplay: '',
          aggregationPeriod: currentAggregationPeriod,
          rawPointsInGroup: pointsInGroup, // Always include raw points for potential modal use
        };

        if (currentAggregationPeriod === 'hourly') {
          aggregatedPoint.timestampDisplay = format(startOfHour(firstPointDate), 'MMM dd HH:00');
        } else if (currentAggregationPeriod === 'daily') {
          aggregatedPoint.timestampDisplay = format(startOfDay(firstPointDate), 'MMM dd, yyyy');
        } else if (currentAggregationPeriod === 'weekly') {
           aggregatedPoint.timestampDisplay = 'W' + getISOWeek(firstPointDate) + ', ' + getYear(firstPointDate);
        } else if (currentAggregationPeriod === 'monthly') {
          aggregatedPoint.timestampDisplay = format(startOfMonth(firstPointDate), 'MMM yyyy');
        }

        selectedMetrics.forEach(metricKey => {
          const config = METRIC_CONFIGS[metricKey];
          if (config && !config.isString) {
            const values = pointsInGroup.map(p => p[metricKey] as number).filter(v => typeof v === 'number' && isFinite(v));
            if (values.length > 0) {
              const average = values.reduce((sum, val) => sum + val, 0) / values.length;
              (aggregatedPoint as any)[`${metricKey}_avg`] = average;
              (aggregatedPoint as any)[`${metricKey}_min`] = Math.min(...values);
              (aggregatedPoint as any)[`${metricKey}_max`] = Math.max(...values);
              (aggregatedPoint as any)[`${metricKey}_stdDev`] = calculateStandardDeviation(values);
              (aggregatedPoint as any)[`${metricKey}_count`] = values.length;
              if (selectedChartType === 'line' || selectedChartType === 'bar' || (selectedChartType === 'scatter' && isActuallyAggregated)) {
                  aggregatedPoint[metricKey] = average;
              }
            } else {
              (aggregatedPoint as any)[`${metricKey}_avg`] = null;
              (aggregatedPoint as any)[`${metricKey}_min`] = null;
              (aggregatedPoint as any)[`${metricKey}_max`] = null;
              (aggregatedPoint as any)[`${metricKey}_stdDev`] = 0;
              (aggregatedPoint as any)[`${metricKey}_count`] = 0;
              if (selectedChartType === 'line' || selectedChartType === 'bar' || (selectedChartType === 'scatter' && isActuallyAggregated)) {
                   aggregatedPoint[metricKey] = null;
              }
            }
          } else if (config && config.isString) {
             const firstValue = pointsInGroup[0]?.[metricKey];
             aggregatedPoint[metricKey] = firstValue;
             // For string types, stats are less relevant but count is useful
            (aggregatedPoint as any)[`${metricKey}_avg`] = null;
            (aggregatedPoint as any)[`${metricKey}_min`] = null;
            (aggregatedPoint as any)[`${metricKey}_max`] = null;
            (aggregatedPoint as any)[`${metricKey}_stdDev`] = 0;
            (aggregatedPoint as any)[`${metricKey}_count`] = pointsInGroup.length;
          }
        });
        return aggregatedPoint;
      }).sort((a, b) => a.timestamp - b.timestamp);
      return aggregatedResult;
    }

    // For 'raw' data mode (non-aggregated)
    return displayedData.map(point => ({
        ...point,
        timestampDisplay: formatTimestampToDdMmHhMmUTC(point.timestamp),
        tooltipTimestampFull: formatTimestampToFullUTC(point.timestamp),
    }));
  }, [displayedData, selectedChartType, aggregationType, selectedMetrics, isActuallyAggregated]);

  const minMaxReferenceData = useMemo(() => {
    if (!showMinMaxLines || chartData.length === 0 || selectedChartType !== 'line') {
      return undefined;
    }
    const result: Record<string, { minValue: number; maxValue: number }> = {};
    selectedMetrics.forEach(metricKey => {
      const config = METRIC_CONFIGS[metricKey];
      if (config && !config.isString) {
        const values = chartData.map(p => {
          return (p as any)[metricKey] as number;
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
  }, [showMinMaxLines, chartData, selectedMetrics, selectedChartType]);


  const handleDetailedChartClick = (clickedData: WeatherDataPoint | AggregatedDataPoint | null, rechartsClickProps: any | null) => {
    console.log('[HistoricalDataSection] handleDetailedChartClick received:', { clickedData, rechartsClickProps });
    console.log(`[HistoricalDataSection] Current state: selectedChartType: ${selectedChartType}, isActuallyAggregated: ${isActuallyAggregated}`);

    const isRawLineOrScatterClickForAI =
      ((selectedChartType === 'line' || selectedChartType === 'scatter') && !isActuallyAggregated);

    if (isRawLineOrScatterClickForAI && onChartPointClickForAI) {
      if (clickedData && ('rawTimestampString' in clickedData || ('timestamp' in clickedData && !isActuallyAggregated && !('aggregationPeriod' in clickedData)))) {
          console.log('[HistoricalDataSection] Handling AI forecast click with point:', clickedData);
          onChartPointClickForAI(clickedData as WeatherDataPoint);
          return;
      }
    }

    if (selectedChartType === 'scatter' && isActuallyAggregated && clickedData && rechartsClickProps) {
      const payloadPoint = clickedData as AggregatedDataPoint;
      let metricKeyFromPayload: MetricKey | undefined = undefined;

      console.log("[HistoricalDataSection] Scatter click: Full rechartsClickProps object (passed from WeatherChart as second arg):", rechartsClickProps);
      console.log("[HistoricalDataSection] Scatter click: selectedMetrics array:", selectedMetrics);
      console.log("[HistoricalDataSection] Scatter click: payloadPoint (clickedData from chart - first arg):", payloadPoint);

      if (rechartsClickProps && rechartsClickProps.explicitMetricKey) {
        metricKeyFromPayload = rechartsClickProps.explicitMetricKey as MetricKey;
        console.log(`[HistoricalDataSection] Derived metricKey '${metricKeyFromPayload}' from explicitMetricKey.`);
      } else {
        console.error("[HistoricalDataSection] Cannot reliably infer metricKey for modal from explicitMetricKey. Aborting modal open.");
        return;
      }

      const baseMetricKey = metricKeyFromPayload;
      const metricConfig = METRIC_CONFIGS[baseMetricKey];

      if (!metricConfig) {
        console.error(`[HistoricalDataSection] No metricConfig for baseMetricKey: ${baseMetricKey}. Modal will not open.`);
        return;
      }
      if (metricConfig.isString) {
        console.log(`[HistoricalDataSection] Metric ${baseMetricKey} is string. No detail modal for string data. Modal will not open.`);
        return;
      }

      const rawPointsForAggregate = payloadPoint.rawPointsInGroup;

      if (!rawPointsForAggregate || rawPointsForAggregate.length === 0) {
        console.warn(`[HistoricalDataSection] No raw points in payloadPoint.rawPointsInGroup for aggregate ${payloadPoint.timestampDisplay} of ${baseMetricKey}. Modal will not open.`);
        return;
      }

      const aggregationFullLabel = `${payloadPoint.aggregationPeriod?.charAt(0).toUpperCase() + payloadPoint.aggregationPeriod!.slice(1)} - ${payloadPoint.timestampDisplay}`;

      const modalDataPayload: DetailModalDataTypeFromType = {
        metricKey: baseMetricKey,
        metricConfig,
        aggregationLabel: aggregationFullLabel,
        stats: {
          avg: payloadPoint[`${baseMetricKey}_avg` as keyof AggregatedDataPoint] as number | undefined,
          min: payloadPoint[`${baseMetricKey}_min` as keyof AggregatedDataPoint] as number | undefined,
          max: payloadPoint[`${baseMetricKey}_max` as keyof AggregatedDataPoint] as number | undefined,
          stdDev: payloadPoint[`${baseMetricKey}_stdDev` as keyof AggregatedDataPoint] as number | undefined,
          count: payloadPoint[`${baseMetricKey}_count` as keyof AggregatedDataPoint] as number | undefined,
        },
        rawPoints: rawPointsForAggregate,
      };

      console.log('[HistoricalDataSection] Preparing to open detail modal with data (BEFORE SETTING STATE):', JSON.parse(JSON.stringify(modalDataPayload)));
      if (!modalDataPayload.metricKey || !modalDataPayload.metricConfig || !modalDataPayload.rawPoints || modalDataPayload.rawPoints.length === 0) {
          console.error("[HistoricalDataSection] CRITICAL: modalDataPayload is incomplete before setting state!", modalDataPayload);
          return;
      }

      setDetailModalData(modalDataPayload);
      setIsDetailModalOpen(true);
      console.log('[HistoricalDataSection] setIsDetailModalOpen called with true.');
      return;
    } else if (rechartsClickProps === null && clickedData === null && onChartPointClickForAI) {
        console.log('[HistoricalDataSection] Empty chart space click. Calling onChartPointClickForAI(null).');
        onChartPointClickForAI(null);
        return;
    }

    console.log('[HistoricalDataSection] Click did not match conditions for AI or Modal.');
  };

  console.log(`[HistoricalDataSection] RENDERING. isDetailModalOpen: ${isDetailModalOpen}, detailModalData exists: ${!!detailModalData}, chartType: ${selectedChartType}`);


  return (
    <>
      <section className="mb-8">
        <h2
          className={`text-2xl font-headline font-semibold mb-4`}
        >Historical Data Analysis</h2>

        <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
                  disabled={(selectedChartType === 'bar' && aggregationType === 'raw')}
                >
                  <SelectTrigger id="aggregation-type-select" className="w-full sm:w-auto sm:min-w-[150px]">
                    <SelectValue placeholder="Select aggregation" />
                  </SelectTrigger>
                  <SelectContent>
                    { (selectedChartType === 'line' || selectedChartType === 'scatter' ) && <SelectItem value="raw">Raw Data</SelectItem> }
                    <SelectItem value="hourly">Hourly</SelectItem>
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
            onPointClick={handleDetailedChartClick}
            chartType={selectedChartType}
            isAggregated={isActuallyAggregated}
            showMinMaxLines={showMinMaxLines && selectedChartType === 'line'}
            minMaxReferenceData={minMaxReferenceData}
          />
        </div>
      </section>
      {isDetailModalOpen && detailModalData && (
          <DetailedDistributionModal
            isOpen={isDetailModalOpen}
            onClose={() => {
              console.log('[HistoricalDataSection] Closing modal.');
              setIsDetailModalOpen(false);
              setDetailModalData(null);
            }}
            data={detailModalData}
          />
       )}
    </>
  );
};

export default HistoricalDataSection;
