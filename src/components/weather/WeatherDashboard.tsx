
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import RealtimeDataSection from './RealtimeDataSection';
import HistoricalDataSection from './HistoricalDataSection';
import AIForecastSection from './AIForecastSection';
import type { WeatherDataPoint } from '@/types/weather';

const WeatherDashboard: FC = () => {
  const [dataForAiForecast, setDataForAiForecast] = useState<WeatherDataPoint[] | null>(null);

  const handleChartPointClick = (point: WeatherDataPoint) => {
    // The AI forecast expects an array of historical data.
    // We'll provide the single clicked point as an array.
    setDataForAiForecast([point]);
  };

  return (
    <div className="space-y-8">
      <RealtimeDataSection />
      <HistoricalDataSection onChartPointClick={handleChartPointClick} />
      <AIForecastSection initialDataForForecast={dataForAiForecast} />
    </div>
  );
};

export default WeatherDashboard;
