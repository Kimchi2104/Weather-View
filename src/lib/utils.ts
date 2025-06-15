import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DayNightPeriod, WeatherDataPoint } from "@/types/weather";
import regression from 'regression';
import type { TrendLineType } from '@/types/weather';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateMovingAverage(data: number[], windowSize: number): (number | null)[] {
  if (windowSize <= 1 || data.length < windowSize) {
    return Array(data.length).fill(null);
  }
  const result: (number | null)[] = Array(windowSize - 1).fill(null);
  for (let i = windowSize - 1; i < data.length; i++) {
    const window = data.slice(i - windowSize + 1, i + 1);
    const sum = window.reduce((acc, val) => acc + val, 0);
    result.push(sum / windowSize);
  }
  return result;
}

export function calculateTrendLine(
  data: any[], 
  dataKey: string,
  trendType: TrendLineType,
  options: { polynomialOrder?: number; movingAveragePeriod?: number } = {}
): any[] {
  if (data.length < 2 || trendType === 'none') return data;
  
  const dataWithIndex = data.map((d, i) => ({ ...d, index: i }));
  const trendDataKey = `${dataKey}_trend`;

  if (trendType === 'movingAverage') {
    const values = data.map(d => d[dataKey] as number);
    const movingAverage = calculateMovingAverage(values, options.movingAveragePeriod || 7);
    return dataWithIndex.map((point, i) => ({ ...point, [trendDataKey]: movingAverage[i] }));
  }

  const regressionData = dataWithIndex
    .map(point => [point.index, point[dataKey] as number])
    .filter((p): p is [number, number] => typeof p[1] === 'number' && isFinite(p[1]));

  if (regressionData.length < 2) return data;

  try {
    const result = regression[trendType](regressionData, { order: options.polynomialOrder || 2, precision: 3 });
    const trendPoints = result.points.map(p => p[1]);
    
    return dataWithIndex.map((point) => {
      const regressionPoint = regressionData.find(p => p[0] === point.index);
      if (regressionPoint) {
        const trendIndex = regressionData.indexOf(regressionPoint);
        return { ...point, [trendDataKey]: trendPoints[trendIndex] };
      }
      return point;
    });
  } catch(e) {
    console.error(`Could not calculate trend line for type "${trendType}":`, e);
    return data;
  }
}


export function parseCustomTimestamp(timestampStr: string | undefined): number | null {
  if (!timestampStr || typeof timestampStr !== 'string') {
    return null;
  }
  const parts = timestampStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10); // Month from regex is 1-indexed
    const year = parseInt(parts[3], 10);
    const hour = parseInt(parts[4], 10);
    const minute = parseInt(parts[5], 10);
    const second = parseInt(parts[6], 10);

    const localDate = new Date(year, month - 1, day, hour, minute, second);

    if (isNaN(localDate.getTime())) {
      console.error(`[parseCustomTimestamp] CRITICAL: Invalid date constructed from local components. Raw: "${timestampStr}", Attempted Local Components -> Year: ${year}, Month(0-idx): ${month - 1}, Day: ${day}, H:${hour}, M:${minute}, S:${second}`);
      return null;
    }
    return localDate.getTime();
  }
  console.error(`[parseCustomTimestamp] CRITICAL: Could not parse format. Raw: "${timestampStr}". Expected "dd/MM/yyyy HH:mm:ss" (day/month can be single or double digit).`);
  return null;
}

import type { RawFirebaseDataPoint } from '@/types/weather';

const parseNumeric = (val: any): number | undefined => {
  if (val === undefined || val === null) return undefined;
  const num = Number(val);
  return isFinite(num) ? num : undefined;
};

export function transformRawDataToWeatherDataPoint(rawData: RawFirebaseDataPoint, recordKey?: string): WeatherDataPoint | null {
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  if (typeof rawData.timestamp !== 'string' || rawData.timestamp.trim() === '') {
    return null;
  }

  const numericalTimestamp = parseCustomTimestamp(rawData.timestamp);

  if (numericalTimestamp === null) {
    return null;
  }

  let precipitationValue: string;
  if (typeof rawData.rainStatus === 'string') {
    precipitationValue = rawData.rainStatus;
  } else {
    precipitationValue = "Unknown";
  }

  const temperatureValue = parseNumeric(rawData.temperature);
  const humidityValue = parseNumeric(rawData.humidity);
  const luxValue = parseNumeric(rawData.lux);

  const airQualityStringValue = typeof rawData.airQuality === 'string' ? rawData.airQuality : "Unknown";

  const aqiPpmValue = parseNumeric(rawData.mq135PPM);

  const pressureValue = parseNumeric(rawData.pressure);
  const rainAnalogValue = parseNumeric(rawData.rainAnalog);

  let precipitationIntensityValue: number | undefined = undefined;
  if (rainAnalogValue !== undefined) {
    precipitationIntensityValue = ((4095 - rainAnalogValue) / 4095) * 100;
    precipitationIntensityValue = Math.max(0, Math.min(100, precipitationIntensityValue));
  }


  const finalTemperature = temperatureValue === undefined ? 0 : temperatureValue;
  const finalHumidity = humidityValue === undefined ? 0 : humidityValue;
  const finalLux = luxValue === undefined ? 0 : luxValue;
  const finalAqiPpm = aqiPpmValue === undefined ? 0 : aqiPpmValue;

  const sunriseSunsetStatus = finalLux > 400 ? "Sunrise" : "Sunset";


  const transformedPoint: WeatherDataPoint = {
    timestamp: numericalTimestamp,
    rawTimestampString: rawData.timestamp,
    temperature: finalTemperature,
    humidity: finalHumidity,
    precipitation: precipitationValue,
    airQuality: airQualityStringValue,
    aqiPpm: finalAqiPpm,
    lux: finalLux,
    sunriseSunset: sunriseSunsetStatus,
    rainAnalog: rainAnalogValue,
    precipitationIntensity: precipitationIntensityValue,
    ...(pressureValue !== undefined && { pressure: pressureValue }),
  };

  return transformedPoint;
}

export const formatTimestampToDdMmHhMmUTC = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
};

export const formatTimestampToFullUTC = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} UTC`;
};

export function formatDuration(milliseconds: number): string {
    if (milliseconds < 0) {
        return "N/A";
    }
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

export function calculateDayNightPeriods(
    data: WeatherDataPoint[]
): DayNightPeriod[] {
    const periods: DayNightPeriod[] = [];
    if (data.length === 0) {
        return periods;
    }

    let currentPeriod: DayNightPeriod | null = null;

    for (let i = 0; i < data.length; i++) {
        const point = data[i];
        const type = point.sunriseSunset === "Sunrise" ? "Day" : "Night";

        if (!currentPeriod) {
            currentPeriod = {
                type: type,
                startTimestamp: point.timestamp,
                endTimestamp: point.timestamp,
                duration: 0,
            };
            continue;
        }

        if (type !== currentPeriod.type) {
            currentPeriod.endTimestamp = point.timestamp;
            currentPeriod.duration =
                currentPeriod.endTimestamp - currentPeriod.startTimestamp;
            periods.push(currentPeriod);

            currentPeriod = {
                type: type,
                startTimestamp: point.timestamp,
                endTimestamp: point.timestamp,
                duration: 0,
            };
        }
    }

    if (currentPeriod) {
        const lastPoint = data[data.length - 1];
        currentPeriod.endTimestamp = lastPoint.timestamp;
        currentPeriod.duration =
            currentPeriod.endTimestamp - currentPeriod.startTimestamp;
        periods.push(currentPeriod);
    }

    return periods;
}