
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
  if (!timestampStr || typeof timestampStr !== 'string') return null;
  const parts = timestampStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
  if (parts) {
    // parts[0] is the full match
    // parts[1]=dd, parts[2]=MM, parts[3]=yyyy, parts[4]=HH, parts[5]=mm, parts[6]=ss
    // JavaScript Date month is 0-indexed (0 for January, 11 for December)
    const year = parseInt(parts[3], 10);
    const month = parseInt(parts[2], 10) - 1; // Adjust month for 0-indexing
    const day = parseInt(parts[1], 10);
    const hour = parseInt(parts[4], 10);
    const minute = parseInt(parts[5], 10);
    const second = parseInt(parts[6], 10);

    const date = new Date(year, month, day, hour, minute, second);
    // Check if date is valid, e.g. not "Invalid Date" due to out-of-range values
    if (isNaN(date.getTime())) {
      console.warn(`[TimestampParsing] Invalid date constructed for timestamp: ${timestampStr}`);
      return null;
    }
    return date.getTime();
  }
  console.warn(`[TimestampParsing] Could not parse timestamp format: ${timestampStr}. Expected "dd/MM/yyyy HH:mm:ss"`);
  return null;
}

// Helper to convert raw Firebase data to WeatherDataPoint
import type { RawFirebaseDataPoint, WeatherDataPoint } from '@/types/weather';

export function transformRawDataToWeatherDataPoint(rawData: RawFirebaseDataPoint): WeatherDataPoint | null {
  const numericalTimestamp = parseCustomTimestamp(rawData.timestamp);
  if (numericalTimestamp === null) {
    console.warn('[DataTransform] Skipping record due to unparseable timestamp:', rawData);
    return null;
  }

  let aqiValue: number;
  if (typeof rawData.airQuality === 'string') {
    // Basic mapping for "Safe Air". This can be expanded.
    // Lower AQI is generally better.
    switch (rawData.airQuality.toLowerCase()) {
      case 'safe air':
        aqiValue = 20; // Example value for "good" air quality
        break;
      case 'moderate':
        aqiValue = 75;
        break;
      case 'unhealthy for sensitive groups':
        aqiValue = 125;
        break;
      case 'unhealthy':
        aqiValue = 175;
        break;
      case 'very unhealthy':
        aqiValue = 250;
        break;
      case 'hazardous':
        aqiValue = 350;
        break;
      default:
        aqiValue = 50; // Default if unknown string
    }
  } else if (typeof rawData.airQuality === 'number') {
    aqiValue = rawData.airQuality;
  } else {
    aqiValue = 0; // Default if missing or wrong type
  }

  return {
    timestamp: numericalTimestamp,
    temperature: typeof rawData.temperature === 'number' ? rawData.temperature : 0,
    humidity: typeof rawData.humidity === 'number' ? rawData.humidity : 0,
    // Assuming rainAnalog can be used directly for precipitation.
    // If 4095 means "No Rain", and lower values mean rain, this might need inversion
    // or scaling depending on how it should be represented (e.g., in mm).
    // For now, using raw value. Consider 0 if "No Rain".
    precipitation: rawData.rainStatus === "No Rain" ? 0 : (typeof rawData.rainAnalog === 'number' ? rawData.rainAnalog : 0),
    airQualityIndex: aqiValue,
    lux: typeof rawData.lux === 'number' ? rawData.lux : 0,
  };
}
