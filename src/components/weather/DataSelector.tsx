
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

    if (checked) {
      if (metricKey === 'sunriseSunset') {
        // If 'sunriseSunset' is checked, it becomes the *only* selection.
        newSelected = ['sunriseSunset'];
      } else {
        // If another metric is checked, add it to the current selection,
        // ensuring 'sunriseSunset' is removed if it was there.
        // Also ensure no duplicates by starting from a filtered list.
        const otherSelectedMetrics = selectedMetrics.filter(key => key !== 'sunriseSunset' && key !== metricKey);
        newSelected = [...otherSelectedMetrics, metricKey];
      }
    } else {
      // If a metric is unchecked, simply remove it.
      newSelected = selectedMetrics.filter((key) => key !== metricKey);
    }
    // Ensure uniqueness, although the logic above should handle it.
    onSelectionChange(Array.from(new Set(newSelected)));
  };

  // Determine disabled states for checkboxes
  const isOnlySunriseSunsetSelected = selectedMetrics.length === 1 && selectedMetrics[0] === 'sunriseSunset';
  const areOtherMetricsSelected = selectedMetrics.some(key => key !== 'sunriseSunset');

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Select Metrics to Display:</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-2">
        {availableMetrics.map((metric) => {
          let isDisabled = false;
          if (metric.key === 'sunriseSunset') {
            // Disable "Day/Night" if any other metric is selected
            isDisabled = areOtherMetricsSelected;
          } else {
            // Disable other metrics if "Day/Night" is the only one selected
            isDisabled = isOnlySunriseSunsetSelected;
          }

          return (
            <div key={metric.key} className="flex items-center space-x-2">
              <Checkbox
                id={`metric-${metric.key}`}
                checked={selectedMetrics.includes(metric.key)}
                onCheckedChange={(checkedState) => handleCheckboxChange(metric.key, !!checkedState)}
                disabled={isDisabled}
                className={`border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label={`Select ${metric.name}`}
              />
              <Label
                htmlFor={`metric-${metric.key}`}
                className={`text-sm ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {metric.name}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DataSelector;
