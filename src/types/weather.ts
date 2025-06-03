export interface WeatherDataPoint {
  timestamp: number; // Unix timestamp
  precipitation: number; // mm
  temperature: number; // °C
  humidity: number; // %
  lightPollution: number; // lux or similar scale
  airQualityIndex: number; // AQI value
}

export interface HistoricalData {
  [key: string]: WeatherDataPoint[]; // e.g. "station1": [WeatherDataPoint, ...]
}

export interface RealtimeData {
  [key: string]: WeatherDataPoint; // e.g. "station1": WeatherDataPoint
}

export type MetricKey = keyof Omit<WeatherDataPoint, 'timestamp'>;

export interface MetricConfig {
  name: string;
  unit: string;
  Icon: React.ElementType;
  color: string; // tailwind color class for chart series
  healthyMin?: number;
  healthyMax?: number;
}
