
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses a timestamp string in "dd/MM/yyyy HH:mm:ss" format to a Unix timestamp (milliseconds).
 * @param timestampStr The timestamp string to parse.
 * @returns A Unix timestamp in milliseconds, or null if parsing fails.
 */
export function parseCustomTimestamp(timestampStr: string | undefined): number | null {
  if (!timestampStr || typeof timestampStr !== 'string') {
    console.warn(`[parseCustomTimestamp] Invalid input: timestampStr is undefined or not a string:`, timestampStr);
    return null;
  }
  const parts = timestampStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
  if (parts) {
    const year = parseInt(parts[3], 10);
    const month = parseInt(parts[2], 10) - 1; // Adjust month for 0-indexing
    const day = parseInt(parts[1], 10);
    const hour = parseInt(parts[4], 10);
    const minute = parseInt(parts[5], 10);
    const second = parseInt(parts[6], 10);

    const date = new Date(Date.UTC(year, month, day, hour, minute, second)); // Use UTC to avoid local timezone issues if data is consistently UTC based
    if (isNaN(date.getTime())) {
      console.warn(`[parseCustomTimestamp] Invalid date constructed for timestamp string: ${timestampStr}`);
      return null;
    }
    return date.getTime();
  }
  console.warn(`[parseCustomTimestamp] Could not parse timestamp format: ${timestampStr}. Expected "dd/MM/yyyy HH:mm:ss"`);
  return null;
}

// Helper to convert raw Firebase data to WeatherDataPoint
import type { RawFirebaseDataPoint, WeatherDataPoint } from '@/types/weather';

export function transformRawDataToWeatherDataPoint(rawData: RawFirebaseDataPoint, recordKey?: string): WeatherDataPoint | null {
  console.log(`[transformRawDataToWeatherDataPoint] Processing raw record (key: ${recordKey || 'N/A'}):`, JSON.parse(JSON.stringify(rawData)));

  if (!rawData || typeof rawData !== 'object') {
    console.warn('[transformRawDataToWeatherDataPoint] Invalid rawData input (not an object or null):', rawData);
    return null;
  }

  const numericalTimestamp = parseCustomTimestamp(rawData.timestamp);
  console.log(`[transformRawDataToWeatherDataPoint] Parsed timestamp for (key: ${recordKey || 'N/A'}):`, numericalTimestamp, rawData.timestamp);

  if (numericalTimestamp === null) {
    console.warn(`[transformRawDataToWeatherDataPoint] Skipping record (key: ${recordKey || 'N/A'}) due to unparseable timestamp:`, rawData.timestamp);
    return null;
  }

  let precipitationValue: string;
  if (typeof rawData.rainStatus === 'string') {
    precipitationValue = rawData.rainStatus;
  } else {
    console.warn(`[transformRawDataToWeatherDataPoint] rainStatus is missing or not a string for (key: ${recordKey || 'N/A'}). Defaulting to "Unknown". Value:`, rawData.rainStatus);
    precipitationValue = "Unknown";
  }
  console.log(`[transformRawDataToWeatherDataPoint] Precipitation status for (key: ${recordKey || 'N/A'}):`, precipitationValue);
  
  const temperatureValue = typeof rawData.temperature === 'number' ? rawData.temperature : 0;
  const humidityValue = typeof rawData.humidity === 'number' ? rawData.humidity : 0;
  const luxValue = typeof rawData.lux === 'number' ? rawData.lux : 0;
  
  const airQualityStringValue = typeof rawData.airQuality === 'string' ? rawData.airQuality : "Unknown";
  if (typeof rawData.airQuality !== 'string') console.warn(`[transformRawDataToWeatherDataPoint] airQuality (string) is not a string for (key: ${recordKey || 'N/A'}). Defaulting to "Unknown". Value:`, rawData.airQuality);
  console.log(`[transformRawDataToWeatherDataPoint] Air Quality (string) for (key: ${recordKey || 'N/A'}):`, airQualityStringValue);
  
  const aqiPpmValue = typeof rawData.mq135PPM === 'number' ? rawData.mq135PPM : 0;
  if (typeof rawData.mq135PPM !== 'number') console.warn(`[transformRawDataToWeatherDataPoint] mq135PPM (for AQI PPM) is not a number for (key: ${recordKey || 'N/A'}). Defaulting to 0. Value:`, rawData.mq135PPM);
  console.log(`[transformRawDataToWeatherDataPoint] AQI PPM (from mq135PPM) for (key: ${recordKey || 'N/A'}):`, aqiPpmValue);

  const pressureValue = typeof rawData.pressure === 'number' ? rawData.pressure : undefined; 

  if (typeof rawData.temperature !== 'number') console.warn(`[transformRawDataToWeatherDataPoint] Temperature is not a number for (key: ${recordKey || 'N/A'}). Defaulting to 0. Value:`, rawData.temperature);
  if (typeof rawData.humidity !== 'number') console.warn(`[transformRawDataToWeatherDataPoint] Humidity is not a number for (key: ${recordKey || 'N/A'}). Defaulting to 0. Value:`, rawData.humidity);
  if (typeof rawData.lux !== 'number') console.warn(`[transformRawDataToWeatherDataPoint] Lux is not a number for (key: ${recordKey || 'N/A'}). Defaulting to 0. Value:`, rawData.lux);
  if (rawData.pressure !== undefined && typeof rawData.pressure !== 'number') console.warn(`[transformRawDataToWeatherDataPoint] Pressure is present but not a number for (key: ${recordKey || 'N/A'}). Setting to undefined. Value:`, rawData.pressure);


  const transformedPoint: WeatherDataPoint = {
    timestamp: numericalTimestamp,
    temperature: temperatureValue,
    humidity: humidityValue,
    precipitation: precipitationValue,
    airQuality: airQualityStringValue,
    aqiPpm: aqiPpmValue,
    lux: luxValue,
    ...(pressureValue !== undefined && { pressure: pressureValue }),
  };

  console.log(`[transformRawDataToWeatherDataPoint] Successfully transformed point for (key: ${recordKey || 'N/A'}):`, JSON.parse(JSON.stringify(transformedPoint)));
  return transformedPoint;
}

