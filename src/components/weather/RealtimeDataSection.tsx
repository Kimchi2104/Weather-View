
"use client";

import type { FC } from 'react';
import { useEffect, useState } from 'react';
import RealtimeDataCard from './RealtimeDataCard';
import type { WeatherDataPoint, MetricKey, MetricConfig, RawFirebaseDataPoint } from '@/types/weather';
import { database } from '@/lib/firebase';
import { ref, onValue, type Unsubscribe } from "firebase/database";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CloudRain, Thermometer, Droplets, SunDim, Wind, Gauge, ShieldCheck, Sun, HelpCircle, CloudSun, CloudFog } from 'lucide-react'; // Added CloudSun, CloudFog
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { transformRawDataToWeatherDataPoint } from '@/lib/utils';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  temperature: { name: 'Temperature', unit: '°C', Icon: Thermometer, color: 'hsl(var(--chart-1))', healthyMin: 0, healthyMax: 35 },
  humidity: { name: 'Humidity', unit: '%', Icon: Droplets, color: 'hsl(var(--chart-2))', healthyMin: 30, healthyMax: 70 },
  precipitation: { name: 'Precipitation', unit: '', Icon: CloudRain, color: 'hsl(var(--chart-3))', isString: true },
  airQuality: { name: 'Air Quality', unit: '', Icon: ShieldCheck, color: 'hsl(var(--chart-4))', isString: true },
  aqiPpm: { name: 'AQI (ppm)', unit: 'ppm', Icon: Wind, color: 'hsl(var(--chart-5))', healthyMin: 0, healthyMax: 300 },
  lux: { name: 'Light Level', unit: 'lux', Icon: SunDim, color: 'hsl(30, 80%, 55%)' },
  pressure: { name: 'Pressure', unit: 'hPa', Icon: Gauge, color: 'hsl(120, 60%, 45%)', healthyMin: 980, healthyMax: 1040 },
};

interface DailyMetricTrend {
  latest: number | string | null;
  min?: number | string;
  max?: number | string;
  average?: number; // Added for daily average
  sparklineData?: { timestamp: number; value: number | undefined }[];
}

type RealtimeSectionState = {
  [key in MetricKey]?: DailyMetricTrend;
} & {
  lastUpdatedRawString?: string | null;
};

interface WeatherStatusStyle {
  Icon: React.ElementType;
  statusTextColorClass: string;
  label: string;
}

const getPrecipitationStyle = (status: string | null): WeatherStatusStyle => {
  if (!status) {
    return { Icon: HelpCircle, statusTextColorClass: 'text-muted-foreground', label: 'Unknown' };
  }
  const s = status.toLowerCase();
  if (s.includes('no rain')) {
    return { 
      Icon: Sun, 
      statusTextColorClass: 'text-orange-500', 
      label: status, 
    };
  }
  if (s.includes('rain')) {
    return { 
      Icon: CloudRain, 
      statusTextColorClass: 'text-blue-500', 
      label: status, 
    };
  }
   if (s.includes('cloudy') || s.includes('clouds')) {
    return {
      Icon: CloudSun,
      statusTextColorClass: 'text-slate-500',
      label: status,
    };
  }
  if (s.includes('fog') || s.includes('mist')) {
    return {
      Icon: CloudFog,
      statusTextColorClass: 'text-sky-600',
      label: status,
    };
  }
  return { Icon: HelpCircle, statusTextColorClass: 'text-muted-foreground', label: status };
};

const getAirQualityStyle = (status: string | null) => {
  if (!status) return { Icon: HelpCircle, color: 'text-muted-foreground', label: 'Unknown' };
  const s = status.toLowerCase();
  if (s.includes('safe') || s.includes('good')) return { Icon: ShieldCheck, color: 'text-green-500', label: status };
  if (s.includes('moderate')) return { Icon: ShieldCheck, color: 'text-yellow-500', label: status };
  if (s.includes('unhealthy for sensitive')) return { Icon: ShieldCheck, color: 'text-orange-500', label: status };
  if (s.includes('unhealthy')) return { Icon: ShieldCheck, color: 'text-red-500', label: status };
  if (s.includes('very unhealthy')) return { Icon: ShieldCheck, color: 'text-purple-500', label: status };
  if (s.includes('hazardous')) return { Icon: ShieldCheck, color: 'text-rose-600', label: status };
  return { Icon: HelpCircle, color: 'text-muted-foreground', label: status };
};


const RealtimeDataSection: FC = () => {
  const [processedData, setProcessedData] = useState<RealtimeSectionState>({});
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();

  const firebaseDataPath = 'devices/TGkMhLL4k4ZFBwgOyRVNKe5mTQq1/records';

  useEffect(() => {
    const dataRef = ref(database, firebaseDataPath);
    const unsubscribe: Unsubscribe = onValue(dataRef, (snapshot) => {
      const rawDataContainer = snapshot.val();

      if (rawDataContainer && typeof rawDataContainer === 'object') {
        const allRecords: [string, RawFirebaseDataPoint][] = Object.entries(rawDataContainer);
        
        const transformedRecords: WeatherDataPoint[] = allRecords
          .map(([key, rawPoint]) => transformRawDataToWeatherDataPoint(rawPoint as RawFirebaseDataPoint, key))
          .filter((point): point is WeatherDataPoint => point !== null && point.timestamp !== null && point.rawTimestampString !== undefined)
          .sort((a, b) => a.timestamp - b.timestamp); 

        if (transformedRecords.length > 0) {
          const latestRecord = transformedRecords[transformedRecords.length - 1];
          
          const todayStart = startOfDay(new Date()).getTime();
          const todayEnd = endOfDay(new Date()).getTime();

          const todayRecords = transformedRecords.filter(p => 
            isWithinInterval(new Date(p.timestamp), { start: todayStart, end: todayEnd })
          );

          const newProcessedData: RealtimeSectionState = {
            lastUpdatedRawString: latestRecord.rawTimestampString, 
          };

          (Object.keys(METRIC_CONFIGS) as MetricKey[]).forEach(key => {
            const config = METRIC_CONFIGS[key];
            const currentMetricData: DailyMetricTrend = { latest: null };

            if (latestRecord) {
                 if (key === 'aqiPpm') currentMetricData.latest = latestRecord.aqiPpm;
                 else if (key === 'airQuality') currentMetricData.latest = latestRecord.airQuality;
                 else currentMetricData.latest = latestRecord[key as Exclude<MetricKey, 'aqiPpm' | 'airQuality'>];
            }
            
            if (!config.isString && todayRecords.length > 0) {
              const numericValues = todayRecords.map(p => {
                if (key === 'aqiPpm') return p.aqiPpm;
                if (key === 'pressure' && p.pressure === undefined) return undefined; // Explicitly handle optional pressure
                const val = p[key as Exclude<MetricKey, 'aqiPpm' | 'airQuality' | 'precipitation' | 'pressure'>];
                return typeof val === 'number' ? val : (key === 'pressure' && typeof p.pressure === 'number' ? p.pressure : undefined);
              }).filter((v): v is number => typeof v === 'number');


              if (numericValues.length > 0) {
                currentMetricData.min = Math.min(...numericValues);
                currentMetricData.max = Math.max(...numericValues);
                currentMetricData.average = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
              }
              
              currentMetricData.sparklineData = todayRecords.map(p => ({
                timestamp: p.timestamp,
                value: (key === 'aqiPpm') ? p.aqiPpm : (key === 'pressure') ? p.pressure : p[key as Exclude<MetricKey, 'aqiPpm' | 'airQuality' | 'precipitation' | 'pressure'>] as number | undefined,
              }));
            }
            newProcessedData[key] = currentMetricData;
          });
          setProcessedData(newProcessedData);

        } else {
          setProcessedData({ lastUpdatedRawString: null });
        }
      } else {
        setProcessedData({ lastUpdatedRawString: null });
      }
      setIsLoading(false);
    }, (error) => {
      console.error("[RealtimeDataSection] Firebase realtime data fetching error:", error);
      setIsLoading(false);
      setProcessedData({ lastUpdatedRawString: null });
    });

    return () => {
      unsubscribe();
    };
  }, [firebaseDataPath]);

  const individualMetricsOrder: MetricKey[] = ['temperature', 'humidity', 'aqiPpm', 'lux', 'pressure'];

  const precipitationLatest = processedData.precipitation?.latest ?? null;
  const airQualityLatest = processedData.airQuality?.latest ?? null;
  
  const precipStyle = getPrecipitationStyle(typeof precipitationLatest === 'string' ? precipitationLatest : null);
  const aqStyle = getAirQualityStyle(typeof airQualityLatest === 'string' ? airQualityLatest : null);


  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-2xl font-headline font-semibold text-foreground`}>
          Real-time Conditions
        </h2>
      </div>
      <p className="text-xs text-muted-foreground mb-1">
            Data is fetched from Firebase path: `{firebaseDataPath}`.
      </p>
      {processedData.lastUpdatedRawString && !isLoading && (
        <p className="text-xs text-muted-foreground mb-4">
          Last updated: {processedData.lastUpdatedRawString}
        </p>
      )}
       {isLoading && (
         <p className="text-xs text-muted-foreground mb-4">Fetching latest data...</p>
       )}


      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="shadow-lg transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-headline text-foreground">Current Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {isLoading ? (
              <>
                <div className="flex items-center space-x-2 py-1">
                  <Skeleton className="h-6 w-6 rounded-full opacity-20" />
                  <Skeleton className="h-6 w-28 opacity-20" />
                </div>
                <div className="flex items-center space-x-2 py-1">
                  <Skeleton className="h-6 w-6 rounded-full opacity-20" />
                  <Skeleton className="h-6 w-32 opacity-20" />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2">
                  <precipStyle.Icon className={`h-6 w-6 ${precipStyle.statusTextColorClass}`} />
                  <span className={`text-md font-semibold ${precipStyle.statusTextColorClass}`}>{precipStyle.label}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <aqStyle.Icon className={`h-6 w-6 ${aqStyle.color}`} />
                  <span className={`text-md font-semibold ${aqStyle.color}`}>{aqStyle.label}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {individualMetricsOrder.map((key) => {
          const config = METRIC_CONFIGS[key];
          const metricData = processedData[key];
          
          return (
            <RealtimeDataCard
              key={key}
              metricKey={key}
              value={metricData?.latest ?? null}
              unit={config.unit}
              label={config.name}
              healthyMin={config.isString ? undefined : config.healthyMin}
              healthyMax={config.isString ? undefined : config.healthyMax}
              isLoading={isLoading}
              isString={config.isString}
              dailyTrendData={config.isString ? undefined : metricData?.sparklineData}
              dailyMin={config.isString ? undefined : metricData?.min}
              dailyMax={config.isString ? undefined : metricData?.max}
              dailyAverage={config.isString ? undefined : metricData?.average} // Pass average
              lineColor={config.color}
            />
          );
        })}
      </div>
    </section>
  );
};

export default RealtimeDataSection;

