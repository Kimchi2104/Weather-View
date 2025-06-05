
"use client";

import type { FC } from 'react';
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig, AggregatedDataPoint } from '@/types/weather';
import { formatTimestampToDdMmHhMmUTC, formatTimestampToFullUTC } from '@/lib/utils';
import { ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

interface LineChartComponentProps {
  data: WeatherDataPoint[] | AggregatedDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isAggregated?: boolean;
  showMinMaxLines?: boolean;
  minMaxReferenceData?: Record<string, { minValue: number; maxValue: number }>;
  onPointClick?: (pointPayload: WeatherDataPoint | AggregatedDataPoint | null, rechartsClickProps: any | null) => void;
  yAxisDomain: [number | 'auto', number | 'auto'];
  chartConfigForShadcn: ChartConfig;
}

const LineChartComponent: FC<LineChartComponentProps> = ({
  data: chartInputData,
  selectedMetrics,
  metricConfigs: METRIC_CONFIGS,
  isAggregated = false,
  showMinMaxLines = false,
  minMaxReferenceData,
  onPointClick,
  yAxisDomain,
  chartConfigForShadcn,
}) => {

  const formattedData = useMemo(() => {
    if (!chartInputData) {
      return [];
    }
    const result = chartInputData.map(point => ({
        ...point,
        timestamp: typeof point.timestamp === 'number' ? point.timestamp : (point.timestampDisplay ? new Date(point.timestampDisplay).getTime() : Date.now()),
        timestampDisplay: point.timestampDisplay || formatTimestampToDdMmHhMmUTC(point.timestamp || Date.now()),
        tooltipTimestampFull: point.tooltipTimestampFull || (isAggregated && (point as AggregatedDataPoint).aggregationPeriod ? point.timestampDisplay : formatTimestampToFullUTC(point.timestamp || Date.now())),
    }));
    return result;
  }, [chartInputData, isAggregated]);

  const yAxisTickFormatter = (value: any) => {
    if (typeof value === 'number' && isFinite(value)) {
      return value.toFixed( Math.abs(value) < 10 && value !== 0 ? 1 : 0 );
    }
    if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      return 'N/A';
    }
    return String(value);
  };

  const handleLineBarChartClick = (rechartsEvent: any) => {
    let activePayloadData: any = null;
    let activePayloadFull: any = null;

    if (rechartsEvent && rechartsEvent.activePayload && rechartsEvent.activePayload.length > 0) {
        activePayloadData = rechartsEvent.activePayload[0].payload;
        activePayloadFull = rechartsEvent.activePayload[0];
        onPointClick?.(activePayloadData, activePayloadFull);
    } else if (rechartsEvent && (rechartsEvent.chartX || rechartsEvent.xValue)) {
        onPointClick?.(null, null);
    } else {
        onPointClick?.(null, null);
    }
  };

   const tooltipLabelFormatter = (label: string | number, payload: any[] | undefined) => {
    if (payload && payload.length > 0 && payload[0].payload.tooltipTimestampFull) {
      return payload[0].payload.tooltipTimestampFull;
    }
    return String(label);
  };

  const tooltipFormatter = (value: any, nameFromRecharts: string, entry: any): React.ReactNode | [string, string] | null => {
    const dataKey = entry.dataKey as string;

    if (typeof nameFromRecharts === 'string' && nameFromRecharts.toLowerCase().includes("timestamp")) return null;
    if (typeof dataKey === 'string') {
        const lowerDataKey = dataKey.toLowerCase();
        if (lowerDataKey === 'timestamp' ||
            lowerDataKey === 'timestampdisplay' ||
            lowerDataKey === 'tooltiptimestampfull' ||
            lowerDataKey.includes("stddev") ||
            lowerDataKey.includes("count") ||
            lowerDataKey.includes("aggregationperiod")
           ) {
            return null;
        }
    }

    let originalMetricKeyForConfig = dataKey;
    let isAvgKey = false;
    if (isAggregated) {
      if (typeof originalMetricKeyForConfig === 'string' && originalMetricKeyForConfig.endsWith('_avg')) {
        originalMetricKeyForConfig = originalMetricKeyForConfig.substring(0, originalMetricKeyForConfig.length - 4);
        isAvgKey = true;
      }
    }
    originalMetricKeyForConfig = originalMetricKeyForConfig as MetricKey;


    const config = METRIC_CONFIGS[originalMetricKeyForConfig];
    const displayName = config?.name || (isAvgKey ? `${originalMetricKeyForConfig} (Avg)` : originalMetricKeyForConfig);

    if (typeof displayName === 'string' && displayName.toLowerCase().includes("timestamp")) return null;
    if (typeof displayName === 'string' && (displayName.toLowerCase().includes('data points') || displayName.toLowerCase().includes('aggregation period'))) return null;
    if (typeof displayName === 'string' && displayName.toLowerCase().includes('std. dev')) return null;


    let displayValue: string;
    if (typeof value === 'number' && isFinite(value)) {
      const precision = (config?.unit === 'ppm' ? 0 : (config?.isString ? 0 : (isAggregated ? 1 : 2)));
      displayValue = value.toFixed(precision);
    } else if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      displayValue = 'N/A';
    } else {
      displayValue = String(value);
    }
    const unitString = (typeof value === 'number' && isFinite(value) && config?.unit) ? ` ${config.unit}` : '';

    return [`${displayValue}${unitString}`, displayName];
  };


  const renderCustomTooltipContent = (props: any) => {
    if (!props.active || !props.payload || props.payload.length === 0) {
      return null;
    }

    const filteredPayload = props.payload.filter((pldItem: any) => {
        const name = typeof pldItem.name === 'string' ? pldItem.name.toLowerCase() : '';
        const dataKey = typeof pldItem.dataKey === 'string' ? pldItem.dataKey.toLowerCase() : '';

        if (name.includes("timestamp") ||
            dataKey === 'timestamp' ||
            dataKey === 'timestampdisplay' ||
            dataKey === 'tooltiptimestampfull' ||
             dataKey.includes("stddev") ||
            dataKey.includes("count") ||
            dataKey.includes("aggregationperiod")
           ) {
          return false;
        }
        return true;
      });

    if (filteredPayload.length === 0) {
      return null;
    }

    return (
      <ChartTooltipContent
        {...props}
        payload={filteredPayload}
        formatter={tooltipFormatter}
        labelFormatter={tooltipLabelFormatter}
      />
    );
  };


  const metricsToRenderForLine = selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);

  const xAxisProps: any = {
    stroke: "hsl(var(--foreground))",
    tick: { fill: "hsl(var(--foreground))", fontSize: 11 },
    dataKey: "timestampDisplay",
    type: "category",
    angle: !isAggregated ? -45 : 0,
    textAnchor: !isAggregated ? "end" : "middle",
    dy: !isAggregated ? 10 : 0,
    height: !isAggregated ? 70 : 30,
    minTickGap: !isAggregated ? 10 : 5,
    interval: isAggregated ? "preserveStartEnd" : (formattedData.length > 20 ? Math.floor(formattedData.length / (formattedData.length > 0 ? Math.min(10, formattedData.length) : 5)) : 0),
  };

  const yAxisProps: any = {
    stroke: "hsl(var(--foreground))",
    tick: { fill: "hsl(var(--foreground))", fontSize: 12 },
    tickFormatter: yAxisTickFormatter,
    domain: yAxisDomain,
    allowDecimals: true,
    type: "number" as const,
    scale: "linear" as const,
    allowDataOverflow: true,
  };

   const metricsWithMinMaxLines = useMemo(() => {
    if (!showMinMaxLines || !minMaxReferenceData) return [];
    return selectedMetrics.filter(metricKey => {
        const metricMinMax = minMaxReferenceData[metricKey];
        const metricConfig = METRIC_CONFIGS[metricKey];
        if (!metricMinMax || !metricConfig || metricConfig.isString) return false;
        const { minValue, maxValue } = metricMinMax;
        return typeof minValue === 'number' && isFinite(minValue) && typeof maxValue === 'number' && isFinite(maxValue);
    }).sort();
  }, [showMinMaxLines, minMaxReferenceData, selectedMetrics, METRIC_CONFIGS]);


  return (
    <LineChart
      data={formattedData}
      margin={{ top: 0, right: 80, left: 30, bottom: 20 }}
      onClick={handleLineBarChartClick}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
       <Tooltip
        content={renderCustomTooltipContent}
        wrapperStyle={{ outline: "none" }}
        cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' } }
        animationDuration={150}
        animationEasing="ease-out"
      />
       <Legend
        wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px' }}
        iconSize={14}
        layout="horizontal"
        align="center"
        verticalAlign="top"
         formatter={(value, entry: any, index) => {
          const rechartsName = entry.name as string | undefined;
          if (typeof rechartsName !== 'string') {
            return value;
          }

          let originalKey = rechartsName;
          if (isAggregated && rechartsName.endsWith('_avg')) {
            originalKey = rechartsName.substring(0, rechartsName.length - 4);
          }
           const config = chartConfigForShadcn[originalKey as MetricKey];
          return config?.label || value;
        }}
      />
      {metricsToRenderForLine.map((key) => {
        const metricConfig = METRIC_CONFIGS[key];
        if (!metricConfig) return null;
        const color = metricConfig.color || '#8884d8';
        const name = chartConfigForShadcn[key]?.label || metricConfig.name || key;
        return (
          <Line
            key={`line-${key}`}
            type="monotone"
            dataKey={key}
            stroke={color}
            name={name}
            strokeWidth={2}
            dot={isAggregated ? { r: 3, fill: color, stroke: color, strokeWidth: 1 } : false}
            connectNulls={false}
            animationDuration={300}
          />
        );
      })}

       {showMinMaxLines && minMaxReferenceData &&
        selectedMetrics.flatMap(metricKey => {
          const metricMinMax = minMaxReferenceData[metricKey];
          const metricConfig = METRIC_CONFIGS[metricKey];

          if (!metricMinMax || !metricConfig || metricConfig.isString ||
              typeof metricMinMax.minValue !== 'number' || !isFinite(metricMinMax.minValue) ||
              typeof metricMinMax.maxValue !== 'number' || !isFinite(metricMinMax.maxValue)
          ) {
            return [];
          }

          const { minValue, maxValue } = metricMinMax;
          const orderIndex = metricsWithMinMaxLines.indexOf(metricKey);
          const activeOrderIndex = orderIndex !== -1 ? orderIndex : 0;

          const dyMinLabel = 5 + activeOrderIndex * 12;
          const dyMaxLabel = -5 - activeOrderIndex * 12;


          return [
            <ReferenceLine
              key={`min-line-${metricKey}`}
              y={minValue}
              stroke={metricConfig.color}
              strokeDasharray="2 2"
              strokeOpacity={0.7}
              strokeWidth={1.5}
              label={{
                value: `Min: ${minValue.toFixed(isAggregated ? 1 : (metricConfig.unit === 'ppm' ? 0 : 2))}${metricConfig.unit || ''}`,
                position: "right",
                textAnchor: "end",
                dx: -5,
                fill: 'hsl(var(--popover-foreground))',
                fontSize: 10,
                dy: dyMinLabel
              }}
            />,
            <ReferenceLine
              key={`max-line-${metricKey}`}
              y={maxValue}
              stroke={metricConfig.color}
              strokeDasharray="2 2"
              strokeOpacity={0.7}
              strokeWidth={1.5}
              label={{
                value: `Max: ${maxValue.toFixed(isAggregated ? 1 : (metricConfig.unit === 'ppm' ? 0 : 2))}${metricConfig.unit || ''}`,
                position: "right",
                textAnchor: "end",
                dx: -5,
                fill: 'hsl(var(--popover-foreground))',
                fontSize: 10,
                dy: dyMaxLabel
              }}
            />
          ];
        })
      }
    </LineChart>
  );
};

export default LineChartComponent;
