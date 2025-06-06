
"use client";

import type { FC } from 'react';
import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ZAxis,
  ReferenceLine,
} from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig, AggregatedDataPoint } from '@/types/weather';
import { formatTimestampToDdMmHhMmUTC, formatTimestampToFullUTC } from '@/lib/utils';
import { ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const MIN_BUBBLE_AREA = 60;
const MAX_BUBBLE_AREA = 1000;


interface ScatterChartComponentProps {
  data: WeatherDataPoint[] | AggregatedDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isAggregated?: boolean;
  onPointClick?: (pointPayload: WeatherDataPoint | AggregatedDataPoint | null, rechartsClickProps: any | null) => void;
  chartConfigForShadcn: ChartConfig;
  yAxisDomain: [number | 'auto', number | 'auto'];
}

const ScatterChartComponent: FC<ScatterChartComponentProps> = ({
  data,
  selectedMetrics,
  metricConfigs: METRIC_CONFIGS,
  isAggregated = false,
  onPointClick,
  chartConfigForShadcn,
  yAxisDomain
}) => {

    const formattedData = useMemo(() => {
    if (!data) {
      return [];
    }
    const result = data.map(point => ({
        ...point,
        timestamp: typeof point.timestamp === 'number' ? point.timestamp : (point.timestampDisplay ? new Date(point.timestampDisplay).getTime() : Date.now()),
        timestampDisplay: point.timestampDisplay || formatTimestampToDdMmHhMmUTC(point.timestamp || Date.now()),
        tooltipTimestampFull: point.tooltipTimestampFull || (isAggregated && (point as AggregatedDataPoint).aggregationPeriod ? point.timestampDisplay : formatTimestampToFullUTC(point.timestamp || Date.now())),
    }));
    return result;
  }, [data, isAggregated]);


  const numericMetricsForScatter = useMemo(() => {
      return selectedMetrics.filter(key => {
        const config = METRIC_CONFIGS[key];
        return config && !config.isString;
      });

  }, [selectedMetrics, METRIC_CONFIGS]);

  const commonCartesianProps = {
    margin: { top: 0, right: 80, left: 30, bottom: 20 },
  };

  const yAxisTickFormatter = (value: any) => {
    if (typeof value === 'number' && isFinite(value)) {
      return value.toFixed( Math.abs(value) < 10 && value !== 0 ? 1 : 0 );
    }
     if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      return 'N/A';
    }
    return String(value);
  };


   const handleScatterPointClick = (scatterPointProps: any, index: number, event: React.MouseEvent<SVGElement>, explicitMetricKey: MetricKey) => {
    if (scatterPointProps && onPointClick) {
      onPointClick(scatterPointProps.payload, { ...scatterPointProps, explicitMetricKey: explicitMetricKey });
    }
  };


   const tooltipLabelFormatter = (label: string | number, payload: any[] | undefined) => {
      if (payload && payload.length > 0 && payload[0].payload.tooltipTimestampFull) {
        return payload[0].payload.tooltipTimestampFull;
      }
       if (payload && payload.length > 0 && payload[0].payload.timestampDisplay) {
        return payload[0].payload.timestampDisplay;
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
            if (nameFromRecharts.toLowerCase().includes("std dev") || dataKey.includes("stddev")) {

            } else {
                return null;
            }
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
    // originalMetricKeyForConfig = originalMetricKeyForConfig as MetricKey;


    const config = METRIC_CONFIGS[originalMetricKeyForConfig as MetricKey];
    const displayName = config?.name || (isAvgKey ? `${originalMetricKeyForConfig} (Avg)` : originalMetricKeyForConfig);


    if (typeof displayName === 'string' && displayName.toLowerCase().includes("timestamp")) return null;
    if (typeof displayName === 'string' && (displayName.toLowerCase().includes('data points') || displayName.toLowerCase().includes('aggregation period'))) return null;


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

    if (isAggregated && config && !config.isString && entry.payload) {
      let tooltipHtml = `<div style="color: ${config.color || 'inherit'};"><strong>${displayName}:</strong> ${displayValue}${unitString}`;
      const stdDevValue = entry.payload[`${originalMetricKeyForConfig}_stdDev`];
      const countValue = entry.payload[`${originalMetricKeyForConfig}_count`];

      if (typeof stdDevValue === 'number' && isFinite(stdDevValue)) {
        tooltipHtml += `<br/>Std. Dev: ${stdDevValue.toFixed(2)}${config?.unit || ''}`;
      }
      if (typeof countValue === 'number' && isFinite(countValue)) {
        tooltipHtml += `<br/>Data Points: ${countValue}`;
      }
      tooltipHtml += `</div>`;
      return React.createElement('div', { dangerouslySetInnerHTML: { __html: tooltipHtml } });
    }

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
             dataKey.includes("count") ||
            dataKey.includes("aggregationperiod")
           ) {
          return false;
        }
         if (dataKey.includes("stddev") && !numericMetricsForScatter.some(m => `${m}_stdDev` === dataKey)) {
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
        hideIndicator={true}
      />
    );
  };


   const xAxisProps: any = {
        stroke: "hsl(var(--foreground))",
        tick: { fill: "hsl(var(--foreground))", fontSize: 11 },
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

    if (!isAggregated) {
        xAxisProps.dataKey = "timestamp";
        xAxisProps.type = "number";
        xAxisProps.domain = ['dataMin', 'dataMax'];
        xAxisProps.tickFormatter = (value: number) => formatTimestampToDdMmHhMmUTC(value);
        xAxisProps.scale = "time";
        xAxisProps.angle = -45;
        xAxisProps.textAnchor = "end";
        xAxisProps.dy = 10;
        xAxisProps.height = 70;
        xAxisProps.minTickGap = 20;
        xAxisProps.interval = formattedData.length > 15 ? Math.floor(formattedData.length / 10) : 0;
    } else {
        xAxisProps.dataKey = "timestampDisplay";
        xAxisProps.type = "category";
        xAxisProps.angle = -45;
        xAxisProps.textAnchor = "end";
        xAxisProps.dy = 10;
        xAxisProps.height = 70;
        xAxisProps.minTickGap = 5;
        xAxisProps.interval = "preserveStartEnd";
    }

  return (
    <ScatterChart
      data={formattedData}
      {...commonCartesianProps}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip
        content={renderCustomTooltipContent}
        wrapperStyle={{ outline: "none" }}
        cursor={false}
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
          } else if (isAggregated && rechartsName.endsWith('_stdDev')) {
              if (numericMetricsForScatter.some(m => `${m}_stdDev` === rechartsName) ) {
                  return null; // Don't show Std Dev in legend for scatter, it's represented by bubble size
              }
          }

          const config = chartConfigForShadcn[originalKey as MetricKey];
          return config?.label || value;
        }}
      />

      {numericMetricsForScatter.length > 0 &&
        numericMetricsForScatter.map((key) => {
          const metricConfig = METRIC_CONFIGS[key];
          if (!metricConfig || metricConfig.isString) return null;

          const yDataKey = isAggregated ? `${key}_avg` : key;
          const baseMetricKey = key;
          const stdDevDataKey = isAggregated ? `${key}_stdDev` : undefined;
          const zAxisUniqueId = `z-${key}`;

          if (isAggregated && stdDevDataKey) {
            const zAxisLabel = chartConfigForShadcn[`${key}_stdDev`]?.label;
            const zAxisName = typeof zAxisLabel === 'string' || typeof zAxisLabel === 'number' ? zAxisLabel : `${metricConfig.name} Std Dev`;
            
            const scatterLabel = chartConfigForShadcn[yDataKey]?.label;
            const scatterName = typeof scatterLabel === 'string' ? scatterLabel : yDataKey;

            return (
              <React.Fragment key={`scatter-elements-${key}`}>
              <ZAxis
                key={`zaxis-${key}`}
                zAxisId={zAxisUniqueId}
                dataKey={stdDevDataKey}
                range={[MIN_BUBBLE_AREA, MAX_BUBBLE_AREA]}
                name={zAxisName}
              />
               <Scatter
                  key={`scatter-${key}`}
                  name={scatterName}
                  dataKey={yDataKey}
                  fill={metricConfig.color || '#8884d8'}
                  shape="circle"
                  animationDuration={300}
                  {...(isAggregated && stdDevDataKey ? { zAxisId: zAxisUniqueId } : {})}
                  onClick={(props, index, event) => handleScatterPointClick(props, index, event as React.MouseEvent<SVGElement>, baseMetricKey)}
                />
               </React.Fragment>
            );
          }
          
          const scatterLabelNoAgg = chartConfigForShadcn[yDataKey]?.label;
          const scatterNameNoAgg = typeof scatterLabelNoAgg === 'string' ? scatterLabelNoAgg : yDataKey;

          return (
              <Scatter
                key={`scatter-${key}`}
                name={scatterNameNoAgg}
                dataKey={yDataKey}
                fill={metricConfig.color || '#8884d8'}
                shape="circle"
                animationDuration={300}
                onClick={(props, index, event) => handleScatterPointClick(props, index, event as React.MouseEvent<SVGElement>, baseMetricKey)}
              />
            );
        })
      }

    </ScatterChart>
  );
};

export default ScatterChartComponent;
