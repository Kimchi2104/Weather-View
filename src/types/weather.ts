
export interface WeatherDataPoint {
  timestamp: number; // Unix timestamp (milliseconds)
  precipitation: string; // e.g., "No Rain", "Rain"
  temperature: number; // °C
  humidity: number; // %
  lux: number; // lux
  airQuality: string; // e.g., "Safe Air", from rawData.airQuality
  aqiPpm: number; // Air Quality Index from MQ135, in PPM, from rawData.mq135PPM
  pressure?: number; // hPa
}

// Represents the raw data structure from Firebase before transformation
export interface RawFirebaseDataPoint {
  airQuality?: string; // This is the string representation like "Safe Air"
  humidity?: number;
  lux?: number;
  mq135PPM?: number; // Source for numerical AQI in PPM
  pressure?: number; // e.g., 1007.10968
  rainAnalog?: number;
  rainStatus?: string; // e.g., "No Rain"
  temperature?: number;
  timestamp?: string; // e.g., "03/06/2025 16:08:39"
  // Allow any other fields that might be present
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
  isString?: boolean; // Flag to indicate if the metric value is a string
}

