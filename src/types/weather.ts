
export interface WeatherDataPoint {
  timestamp: number; // Unix timestamp (milliseconds)
  rawTimestampString?: string; // Original timestamp string from Firebase
  precipitation: string; // e.g., "No Rain", "Rain" - derived from rainStatus
  temperature: number; // °C
  humidity: number; // %
  lux: number; // lux
  airQuality: string; // e.g., "Safe Air", from rawData.airQuality
  aqiPpm: number; // Air Quality Index from MQ135, in PPM, from rawData.mq135PPM
  pressure?: number; // hPa
  sunriseSunset?: string; // "Sunrise" or "Sunset"
  rainAnalog?: number; // Raw analog value for rain sensor
  precipitationIntensity?: number; // Calculated percentage of precipitation intensity
  // Allow dynamic metric keys for aggregated data if needed
  [key: string]: any;
}

// Represents the raw data structure from Firebase before transformation
export interface RawFirebaseDataPoint {
  airQuality?: string;
  humidity?: number;
  lux?: number;
  mq135PPM?: number;
  pressure?: number;
  rainAnalog?: number; // Added raw rain analog value
  rainStatus?: string;
  temperature?: number;
  timestamp?: string;
  sunriseSunset?: string; // Derived for RawDataViewer
  precipitationIntensity?: number; // Added for RawDataViewer
  [key: string]: any;
}


export interface HistoricalData {
  [key: string]: WeatherDataPoint[];
}

export interface RealtimeData {
  [key: string]: WeatherDataPoint;
}

export type MetricKey = 'temperature' | 'humidity' | 'precipitation' | 'lux' | 'airQuality' | 'aqiPpm' | 'pressure' | 'sunriseSunset' | 'rainAnalog' | 'precipitationIntensity';

export interface MetricConfig {
  name: string;
  unit: string;
  Icon: React.ElementType;
  color: string;
  healthyMin?: number;
  healthyMax?: number;
  isString?: boolean;
}

export interface AggregatedDataPoint extends WeatherDataPoint {
  timestampDisplay: string;
  aggregationPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly';
  rawPointsInGroup?: WeatherDataPoint[];
}

export interface DetailModalData {
  metricKey: MetricKey;
  metricConfig: MetricConfig;
  aggregationLabel: string;
  stats: {
    avg?: number;
    min?: number;
    max?: number;
    stdDev?: number;
    count?: number;
  };
  rawPoints: WeatherDataPoint[];
}

// ChartType used in HistoricalDataSection and WeatherChart
// 'violin' is removed from main chart selection but modal might use scatter logic that was part of violin.
// Keeping 'violin' in the type for now if WeatherChart itself still needs to handle it internally,
// but it won't be user-selectable from the main dropdown.
export type ChartType = 'line' | 'bar' | 'scatter' | 'violin';

export interface DayNightPeriod {
  type: 'Day' | 'Night';
  startTimestamp: number;
  endTimestamp: number;
  duration: number; // in milliseconds
}

export interface AggregatedDurationData {
  periodLabel: string; // e.g., "Week 1", "January", "2023"
  averageDayDuration: number; // in milliseconds
  averageNightDuration: number; // in milliseconds
  dayPeriodsCount: number;
  nightPeriodsCount: number;
}

