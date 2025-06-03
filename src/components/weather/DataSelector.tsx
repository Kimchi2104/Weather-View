
"use client";

import type { FC } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { MetricKey } from '@/types/weather';

interface DataSelectorProps {
  availableMetrics: { key: MetricKey; name: string }[];
  selectedMetrics: MetricKey[];
  onSelectionChange: (selected: MetricKey[]) => void;
}

const DataSelector: FC<DataSelectorProps> = ({
  availableMetrics,
  selectedMetrics,
  onSelectionChange,
}) => {
  const handleCheckboxChange = (metricKey: MetricKey, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedMetrics, metricKey]);
    } else {
      onSelectionChange(selectedMetrics.filter((key) => key !== metricKey));
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Select Metrics to Display:</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2">
        {availableMetrics.map((metric) => (
          <div key={metric.key} className="flex items-center space-x-2">
            <Checkbox
              id={`metric-${metric.key}`}
              checked={selectedMetrics.includes(metric.key)}
              onCheckedChange={(checked) => handleCheckboxChange(metric.key, !!checked)}
              className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              aria-label={`Select ${metric.name}`}
            />
            <Label htmlFor={`metric-${metric.key}`} className="text-sm cursor-pointer">
              {metric.name}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataSelector;
