
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import RealtimeDataSection from './RealtimeDataSection';
import HistoricalDataSection from './HistoricalDataSection';
import AIForecastSection from './AIForecastSection';
import RawDataViewer from './RawDataViewer';
import type { WeatherDataPoint } from '@/types/weather';

const WeatherDashboard: FC = () => {
  const [dataForAiForecast, setDataForAiForecast] = useState<WeatherDataPoint[] | null>(null);

  // This function is specifically for populating the AI forecast section
  const handlePointClickForAIForecast = (point: WeatherDataPoint) => {
    setDataForAiForecast([point]);
  };

  return (
    <div className="space-y-8">
      <RealtimeDataSection />
      <HistoricalDataSection 
        onChartPointClickForAI={handlePointClickForAIForecast}
      />
      <AIForecastSection initialDataForForecast={dataForAiForecast} />
      <RawDataViewer />
    </div>
  );
};

export default WeatherDashboard;
