
export interface WeatherDataPoint {
  timestamp: number; // Unix timestamp (milliseconds)
  precipitation: string; // e.g., "No Rain", "Rain"
  temperature: number; // °C
  humidity: number; // %
  lux: number; // lux
  airQuality: string; // e.g., "Safe Air"
  pressure?: number; // hPa
}

// Represents the raw data structure from Firebase before transformation
export interface RawFirebaseDataPoint {
  airQuality?: string; // e.g., "Safe Air"
  humidity?: number;
  lux?: number;
  mq135PPM?: number;
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

export type MetricKey = 'temperature' | 'humidity' | 'precipitation' | 'lux' | 'airQuality' | 'pressure';

export interface MetricConfig {
  name: string;
  unit: string; // Unit can be empty for categorical data like string-based airQuality or precipitation
  Icon: React.ElementType;
  color: string;
  healthyMin?: number; // Not applicable for string-based airQuality or precipitation
  healthyMax?: number; // Not applicable for string-based airQuality or precipitation
}

