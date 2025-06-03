"use client";

import type { FC } from 'react';
import RealtimeDataSection from './RealtimeDataSection';
import HistoricalDataSection from './HistoricalDataSection';
import AIForecastSection from './AIForecastSection';

const WeatherDashboard: FC = () => {
  // This component will orchestrate the different sections of the weather dashboard.
  // It can manage shared state or context if needed in the future.

  return (
    <div className="space-y-8">
      <RealtimeDataSection />
      <HistoricalDataSection />
      <AIForecastSection />
    </div>
  );
};

export default WeatherDashboard;
