"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import DateRangePicker from './DateRangePicker';
import DataSelector from './DataSelector';
import type { DateRange } from 'react-day-picker';
import { subDays, format, getISOWeek, getYear, startOfHour, endOfHour, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { WeatherDataPoint, MetricKey, MetricConfig, RawFirebaseDataPoint, AggregatedDataPoint, DetailModalData as DetailModalDataTypeFromType, ChartType, DayNightPeriod, TrendLineType } from '@/types/weather';
import { database } from '@/lib/firebase';
import { ref, get, type DataSnapshot } from "firebase/database";
import { Label as ShadcnLabel } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { transformRawDataToWeatherDataPoint, calculateDayNightPeriods } from '@/lib/utils';
import { CloudRain, Thermometer, Droplets, SunDim, Wind, Gauge, ShieldCheck, Sun, Moon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import DetailedDistributionModal from './DetailedDistributionModal';
import DayNightDurationModal from './DayNightDurationModal';
import { useTheme } from 'next-themes';
import CVComparisonCard from './CVComparisonCard';

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
  { key: 'rainAnalog', name: 'Rain Analog (Raw)' },
  { key: 'precipitationIntensity', name: 'Precip. Intensity (%)' },
  { key: 'sunriseSunset', name: 'Day/Night' },
];

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'hsl(var(--chart-1))', healthyMin: 0, healthyMax: 35 },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'hsl(var(--chart-2))', healthyMin: 30, healthyMax: 70 },
  precipitation: { name: 'Precipitation Status', unit: '', Icon: CloudRain, color: 'hsl(var(--chart-3))', isString: true },
  rainAnalog: { name: 'Rain Analog', unit: 'raw', Icon: CloudRain, color: 'hsl(200, 70%, 60%)' },
  precipitationIntensity: { name: 'Precip. Intensity', unit: '%', Icon: CloudRain, color: 'hsl(220, 80%, 70%)', healthyMin: 0, healthyMax: 10 },
  airQuality: { name: 'Air Quality', unit: '', Icon: ShieldCheck, color: 'hsl(var(--chart-4))', isString: true },
  aqiPpm: { name: 'AQI (ppm)', unit: 'ppm', Icon: Wind, color: 'hsl(var(--chart-5))', healthyMin: 0, healthyMax: 300 },
  lux: { name: 'Light Level', unit: 'lux', Icon: SunDim, color: 'hsl(30, 80%, 55%)' },
  pressure: { name: 'Pressure', unit: 'hPa', Icon: Gauge, color: 'hsl(120, 60%, 45%)', healthyMin: 980, healthyMax: 1040 },
  sunriseSunset: { name: 'Day/Night', unit: '', Icon: Sun, color: 'hsl(45, 100%, 50%)', isString: true },
};

type AggregationPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';
type ChartAggregationMode = AggregationPeriod | 'raw';

interface HistoricalDataSectionProps {
  onChartPointClickForAI?: (point: WeatherDataPoint | null) => void;
}

const calculateStandardDeviation = (values: number[]): number => {
  if (values.length < 2) return 0;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b) / n;
  return Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
};


const HistoricalDataSection: FC<HistoricalDataSectionProps> = ({ onChartPointClickForAI }) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 7),
    to: new Date(),
  }));
  const [startTime, setStartTime] = useState<string>("00:00");
  const [endTime, setEndTime] = useState<string>("23:59");
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['temperature', 'humidity']);
  const [allFetchedData, setAllFetchedData] = useState<WeatherDataPoint[]>([]);
  const [displayedData, setDisplayedData] = useState<WeatherDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('line');
  const [aggregationType, setAggregationType] = useState<ChartAggregationMode>('raw');
  const [showMinMaxLines, setShowMinMaxLines] = useState<boolean>(false);

  const [trendLineType, setTrendLineType] = useState<TrendLineType>('none');
  const [polynomialOrder, setPolynomialOrder] = useState(2);
  const [movingAveragePeriod, setMovingAveragePeriod] = useState(7);


  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailModalData, setDetailModalData] = useState<DetailModalDataTypeFromType | null>(null);

  const [isDayNightModalOpen, setIsDayNightModalOpen] = useState(false);
  const [dayNightPeriods, setDayNightPeriods] = useState<DayNightPeriod[]>([]);

  const firebaseDataPath = 'devices/TGkMhLL4k4ZFBwgOyRVNKe5mTQq1/records/';

  const fetchAllHistoricalData = useCallback(async () => {
    setIsLoading(true);
    try {
      const dataRef = ref(database, firebaseDataPath);
      const snapshot: DataSnapshot = await get(dataRef);
      if (snapshot.exists()) {
        const rawDataContainer = snapshot.val();
        const recordsArray: [string, RawFirebaseDataPoint][] = Object.entries(rawDataContainer || {});
        const processedData: WeatherDataPoint[] = recordsArray
          .map(([key, rawPoint]) => transformRawDataToWeatherDataPoint(rawPoint, key))
          .filter((point): point is WeatherDataPoint => point !== null && typeof point.timestamp === 'number')
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

  useEffect(() => {
    fetchAllHistoricalData();
  }, [fetchAllHistoricalData]);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      setDisplayedData([]);
      return;
    }
    const fromDate = startOfDay(dateRange.from);
    const toDate = endOfDay(dateRange.to);
    const filtered = allFetchedData.filter(point => {
      const pointDate = new Date(point.timestamp);
      return pointDate >= fromDate && pointDate <= toDate;
    });
    setDisplayedData(filtered);
  }, [allFetchedData, dateRange]);

  const handleMetricSelectionChange = (newlySelectedKeys: MetricKey[]) => {
    setSelectedMetrics(newlySelectedKeys);
    if (newlySelectedKeys.length === 1 && newlySelectedKeys[0] === 'sunriseSunset') {
        setSelectedChartType('scatter');
        setAggregationType('raw');
    }
  };

  const handleChartTypeChange = (newChartType: ChartType) => {
    setSelectedChartType(newChartType);
    if (newChartType === 'bar' && aggregationType === 'raw' && selectedMetrics.length > 0 && selectedMetrics[0] !== 'sunriseSunset') {
      setAggregationType('daily');
    }
  };

  const isAggregationApplicable = selectedChartType !== 'line' && selectedChartType !== 'scatter';
  const isActuallyAggregated = aggregationType !== 'raw';

  const chartData = useMemo(() => {
    if (!isActuallyAggregated) {
      return displayedData;
    }

    const groupedData: Record<string, WeatherDataPoint[]> = {};
    const currentAggregationPeriod = aggregationType as AggregationPeriod;
    
    displayedData.forEach(point => {
        let key = '';
        const pointDate = new Date(point.timestamp);
        if (currentAggregationPeriod === 'hourly') key = format(startOfHour(pointDate), "yyyy-MM-dd'T'HH:00:00");
        else if (currentAggregationPeriod === 'daily') key = format(startOfDay(pointDate), 'yyyy-MM-dd');
        else if (currentAggregationPeriod === 'weekly') key = `${getYear(pointDate)}-W${String(getISOWeek(pointDate)).padStart(2, '0')}`;
        else if (currentAggregationPeriod === 'monthly') key = format(startOfMonth(pointDate), 'yyyy-MM');
        
        if (!groupedData[key]) groupedData[key] = [];
        groupedData[key].push(point);
    });

    return Object.entries(groupedData).map(([groupKey, pointsInGroup]) => {
        const firstPointTimestamp = pointsInGroup[0].timestamp;
        const aggregatedPoint: AggregatedDataPoint = {
            timestamp: firstPointTimestamp,
            timestampDisplay: groupKey,
            aggregationPeriod: currentAggregationPeriod,
            rawPointsInGroup: pointsInGroup,
            temperature: 0, humidity: 0, lux: 0, aqiPpm: 0, pressure: 0, rainAnalog: 0, precipitationIntensity: 0,
            precipitation: '', airQuality: '', sunriseSunset: ''
        };

        if (currentAggregationPeriod === 'daily') aggregatedPoint.timestampDisplay = format(new Date(groupKey), 'MMM dd, yyyy');
        else if (currentAggregationPeriod === 'hourly') aggregatedPoint.timestampDisplay = format(new Date(groupKey), 'MMM dd, HH:00');
        else if (currentAggregationPeriod === 'weekly') aggregatedPoint.timestampDisplay = `Week ${getISOWeek(new Date(groupKey))}, ${getYear(new Date(groupKey))}`;
        else if (currentAggregationPeriod === 'monthly') aggregatedPoint.timestampDisplay = format(new Date(groupKey), 'MMM yyyy');

        HISTORICAL_AVAILABLE_METRICS.forEach(({ key }) => {
            if (!METRIC_CONFIGS[key].isString) {
                const values = pointsInGroup.map(p => p[key] as number).filter(v => typeof v === 'number' && isFinite(v));
                if (values.length > 0) {
                    (aggregatedPoint as any)[`${key}_avg`] = values.reduce((s, v) => s + v, 0) / values.length;
                    (aggregatedPoint as any)[`${key}_min`] = Math.min(...values);
                    (aggregatedPoint as any)[`${key}_max`] = Math.max(...values);
                    (aggregatedPoint as any)[`${key}_stdDev`] = calculateStandardDeviation(values);
                }
            }
        });
        return aggregatedPoint;
    }).sort((a, b) => a.timestamp - b.timestamp);

  }, [displayedData, aggregationType, isActuallyAggregated]);

  const minMaxReferenceData = useMemo(() => {
    if (!showMinMaxLines || chartData.length === 0) return undefined;
    
    const result: Record<string, { minValue: number; maxValue: number }> = {};
    selectedMetrics.forEach(metricKey => {
        const config = METRIC_CONFIGS[metricKey];
        if (config && !config.isString) {
            const dataKey = isActuallyAggregated ? `${metricKey}_avg` : metricKey;
            const values = chartData.map(p => (p as any)[dataKey]).filter((v): v is number => typeof v === 'number' && isFinite(v));
            if (values.length > 0) {
                result[metricKey] = {
                    minValue: Math.min(...values),
                    maxValue: Math.max(...values),
                };
            }
        }
    });
    return result;
  }, [showMinMaxLines, chartData, selectedMetrics, isActuallyAggregated]);

  const handleDetailedChartClick = (clickedData: any, rechartsClickProps: any) => {
    if (onChartPointClickForAI && clickedData && !isActuallyAggregated) {
      onChartPointClickForAI(clickedData as WeatherDataPoint);
    }
  };
  
  const cvDataForCard = useMemo(() => {
    if (displayedData.length < 2) return [];
    return selectedMetrics.filter(key => !METRIC_CONFIGS[key].isString).map(metricKey => {
      const values = displayedData.map(p => p[metricKey] as number).filter(v => typeof v === 'number' && isFinite(v));
      if (values.length < 2) return null;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = calculateStandardDeviation(values);
      return { metricName: METRIC_CONFIGS[metricKey].name, cv: mean > 0 ? (stdDev / mean) * 100 : null };
    }).filter(Boolean) as { metricName: string; cv: number | null }[];
  }, [displayedData, selectedMetrics]);

  const handleDayNightAnalysisClick = () => {
    const periods = calculateDayNightPeriods(displayedData);
    setDayNightPeriods(periods);
    setIsDayNightModalOpen(true);
  };

  const showChartConfigSelectors = !(selectedMetrics.length === 1 && selectedMetrics[0] === 'sunriseSunset');

  return (
    <>
      <section className="mb-8">
        <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">Historical Data Analysis</h2>
        <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
                 <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div>
                        <ShadcnLabel htmlFor="date-range-picker" className="text-sm font-medium text-muted-foreground mb-1 block">Date Range:</ShadcnLabel>
                        <DateRangePicker onDateChange={setDateRange} initialRange={dateRange} id="date-range-picker"/>
                    </div>
                 </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Data is fetched from Firebase path: `{firebaseDataPath}`.
            </p>
            <DataSelector
              availableMetrics={HISTORICAL_AVAILABLE_METRICS}
              selectedMetrics={selectedMetrics}
              onSelectionChange={handleMetricSelectionChange}
            />
            {!showChartConfigSelectors ? (
                <div className="mt-4"><Button onClick={handleDayNightAnalysisClick}>View Day/Night Durations</Button></div>
            ) : (
                <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
                    <div className="flex items-end gap-x-4">
                        <div>
                            <ShadcnLabel htmlFor="chart-type-select" className="text-sm font-medium text-muted-foreground mb-1 block">Chart Type:</ShadcnLabel>
                            <Select value={selectedChartType} onValueChange={(value) => handleChartTypeChange(value as ChartType)}>
                                <SelectTrigger id="chart-type-select" className="w-[150px]"><SelectValue placeholder="Select chart type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="line">Line Chart</SelectItem>
                                    <SelectItem value="bar">Bar Chart</SelectItem>
                                    <SelectItem value="scatter">Scatter Chart</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <ShadcnLabel htmlFor="aggregation-type-select" className="text-sm font-medium text-muted-foreground mb-1 block">Aggregation:</ShadcnLabel>
                            <Select value={aggregationType} onValueChange={(value) => setAggregationType(value as ChartAggregationMode)} disabled={selectedChartType === 'bar' && aggregationType === 'raw'}>
                                <SelectTrigger id="aggregation-type-select" className="w-[150px]"><SelectValue placeholder="Select aggregation" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="raw">Raw Data</SelectItem>
                                    <SelectItem value="hourly">Hourly</SelectItem>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex items-end gap-x-4">
                        <div>
                            <ShadcnLabel htmlFor="trend-type-select" className="text-sm font-medium text-muted-foreground mb-1 block">Trend Line:</ShadcnLabel>
                            <Select value={trendLineType} onValueChange={(value) => setTrendLineType(value as TrendLineType)} disabled={!showChartConfigSelectors}>
                                <SelectTrigger id="trend-type-select" className="w-[150px]"><SelectValue placeholder="Select trend type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="linear">Linear</SelectItem>
                                    <SelectItem value="logarithmic">Logarithmic</SelectItem>
                                    <SelectItem value="exponential">Exponential</SelectItem>
                                    <SelectItem value="power">Power</SelectItem>
                                    <SelectItem value="polynomial">Polynomial</SelectItem>
                                    <SelectItem value="movingAverage">Moving Average</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {trendLineType === 'polynomial' && (
                            <div>
                                <ShadcnLabel htmlFor="poly-order" className="text-xs font-medium text-muted-foreground mb-1 block">Order:</ShadcnLabel>
                                <Input type="number" id="poly-order" value={polynomialOrder} onChange={e => setPolynomialOrder(Math.max(2, Number(e.target.value)))} className="h-10 w-20" />
                            </div>
                        )}
                        {trendLineType === 'movingAverage' && (
                            <div>
                                <ShadcnLabel htmlFor="ma-period" className="text-xs font-medium text-muted-foreground mb-1 block">Period:</ShadcnLabel>
                                <Input type="number" id="ma-period" value={movingAveragePeriod} onChange={e => setMovingAveragePeriod(Math.max(2, Number(e.target.value)))} className="h-10 w-20" />
                            </div>
                        )}
                    </div>
                     <div className="flex items-center space-x-2 pb-1">
                        <Checkbox id="show-min-max-lines" checked={showMinMaxLines} onCheckedChange={(checked) => setShowMinMaxLines(Boolean(checked))} aria-label="Show Min/Max Lines"/>
                        <ShadcnLabel htmlFor="show-min-max-lines" className="text-sm font-medium text-muted-foreground cursor-pointer">Show Min/Max Lines</ShadcnLabel>
                    </div>
                </div>
            )}
        </div>
        <div className="mt-6">
          <WeatherChart
            data={chartData}
            selectedMetrics={selectedMetrics}
            metricConfigs={METRIC_CONFIGS}
            isLoading={isLoading && allFetchedData.length === 0}
            onPointClick={handleDetailedChartClick}
            chartType={selectedChartType}
            isAggregated={isActuallyAggregated}
            showMinMaxLines={showMinMaxLines}
            showTrendLine={trendLineType !== 'none'}
            trendLineType={trendLineType}
            trendLineOptions={{ polynomialOrder, movingAveragePeriod }}
            minMaxReferenceData={minMaxReferenceData}
          />
        </div>
        {cvDataForCard.length > 0 && <CVComparisonCard cvData={cvDataForCard} />}
      </section>
      {isDetailModalOpen && detailModalData && (
        <DetailedDistributionModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} data={detailModalData} />
      )}
      {isDayNightModalOpen && (
        <DayNightDurationModal isOpen={isDayNightModalOpen} onClose={() => setIsDayNightModalOpen(false)} periods={dayNightPeriods} />
      )}
    </>
  );
};

export default HistoricalDataSection;