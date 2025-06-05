
export interface WeatherDataPoint {
  timestamp: number; // Unix timestamp (milliseconds)
  rawTimestampString?: string; // Original timestamp string from Firebase
  precipitation: string; // e.g., "No Rain", "Rain"
  temperature: number; // °C
  humidity: number; // %
  lux: number; // lux
  airQuality: string; // e.g., "Safe Air", from rawData.airQuality
  aqiPpm: number; // Air Quality Index from MQ135, in PPM, from rawData.mq135PPM
  pressure?: number; // hPa
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
  rainAnalog?: number;
  rainStatus?: string; 
  temperature?: number;
  timestamp?: string; 
  [key: string]: any;
}


export interface HistoricalData {
  [key: string]: WeatherDataPoint[];
}

export interface RealtimeData {
  [key: string]: WeatherDataPoint;
}

export type MetricKey = 'temperature' | 'humidity' | 'precipitation' | 'lux' | 'airQuality' | 'aqiPpm' | 'pressure';

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
}

// Moved DetailModalData here for global type usage if needed, 
// though it's primarily used by DetailedDistributionModal and set by HistoricalDataSection.
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
