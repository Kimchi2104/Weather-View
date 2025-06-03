
export interface WeatherDataPoint {
  timestamp: number; // Unix timestamp (milliseconds)
  precipitation: number; // Derived from rainAnalog
  temperature: number; // °C
  humidity: number; // %
  lux: number; // lux, formerly lightPollution
  airQualityIndex: number; // Numerical AQI, derived from airQuality string
}

// Represents the raw data structure from Firebase before transformation
export interface RawFirebaseDataPoint {
  airQuality?: string; // e.g., "Safe Air"
  humidity?: number;
  lux?: number;
  mq135PPM?: number;
  pressure?: number;
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

// Updated to reflect the fields in WeatherDataPoint after mapping
export type MetricKey = 'temperature' | 'humidity' | 'precipitation' | 'lux' | 'airQualityIndex';

export interface MetricConfig {
  name: string;
  unit: string;
  Icon: React.ElementType;
  color: string;
  healthyMin?: number;
  healthyMax?: number;
}
