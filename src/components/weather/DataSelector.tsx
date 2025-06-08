
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
    let newSelected: MetricKey[];

    if (metricKey === 'sunriseSunset') {
      if (checked) {
        // User checks "Day/Night": it becomes the sole selection.
        newSelected = ['sunriseSunset'];
      } else {
        // User unchecks "Day/Night": clear selection.
        newSelected = [];
      }
    } else { // User clicks on a metric other than "Day/Night"
      if (checked) {
        // User checks another metric:
        // Start with current selection, filter out 'sunriseSunset', then add the new metric.
        newSelected = selectedMetrics
          .filter(key => key !== 'sunriseSunset')
          .concat(metricKey);
      } else {
        // User unchecks another metric:
        // Simply remove it from the current selection.
        // 'sunriseSunset' would have already been filtered out if this path is reached while it was active.
        newSelected = selectedMetrics.filter(key => key !== metricKey);
      }
    }
    // Ensure uniqueness and pass to parent
    onSelectionChange(Array.from(new Set(newSelected)));
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Select Metrics to Display:</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-2">
        {availableMetrics.map((metric) => (
            <div key={metric.key} className="flex items-center space-x-2">
              <Checkbox
                id={`metric-${metric.key}`}
                checked={selectedMetrics.includes(metric.key)}
                onCheckedChange={(checkedState) => handleCheckboxChange(metric.key, !!checkedState)}
                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                aria-label={`Select ${metric.name}`}
              />
              <Label
                htmlFor={`metric-${metric.key}`}
                className="text-sm cursor-pointer"
              >
                {metric.name}
              </Label>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default DataSelector;

