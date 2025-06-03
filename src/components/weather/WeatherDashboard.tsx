
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import RealtimeDataSection from './RealtimeDataSection';
import HistoricalDataSection from './HistoricalDataSection';
import AIForecastSection from './AIForecastSection';
import RawDataViewer from './RawDataViewer'; // Import the new component
import type { WeatherDataPoint } from '@/types/weather';
import { useToast } from "@/hooks/use-toast";

const WeatherDashboard: FC = () => {
  const [dataForAiForecast, setDataForAiForecast] = useState<WeatherDataPoint[] | null>(null);
  const { toast } = useToast();

  const handleChartPointClick = (point: WeatherDataPoint) => {
    setDataForAiForecast([point]);
    // Toast notification is now handled by AIForecastSection on prop update
  };

  const handleChartRangeSelect = (selectedPoints: WeatherDataPoint[]) => {
    if (selectedPoints && selectedPoints.length > 0) {
      setDataForAiForecast(selectedPoints);
      // Toast notification is now handled by AIForecastSection on prop update
    } else {
      // Potentially handle brush clear if needed, e.g., setDataForAiForecast(null);
      // For now, we only update if there's a valid selection.
       setDataForAiForecast(null); // Clear if selection is empty
    }
  };

  return (
    <div className="space-y-8">
      <RealtimeDataSection />
      <HistoricalDataSection 
        onChartPointClick={handleChartPointClick}
        onChartRangeSelect={handleChartRangeSelect} 
      />
      <AIForecastSection initialDataForForecast={dataForAiForecast} />
      <RawDataViewer /> {/* Add the new raw data viewer section */}
    </div>
  );
};

export default WeatherDashboard;
