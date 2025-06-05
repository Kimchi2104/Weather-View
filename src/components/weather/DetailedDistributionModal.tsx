
"use client";

import type { FC } from 'react';
import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WeatherDataPoint, MetricConfig, MetricKey, DetailModalData as DetailModalDataType } from '@/types/weather';
import { formatTimestampToFullUTC } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle as ModalCardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface DetailedDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DetailModalDataType | null;
}

const getMetricValueFromPoint = (point: WeatherDataPoint, metricKey: MetricKey, metricConfig?: MetricConfig): number | string | undefined => {
  if (!point || metricKey === undefined) return undefined;

  const value = point[metricKey];

  if (metricConfig?.isString) {
    return typeof value === 'string' ? value : (value !== undefined && value !== null ? String(value) : undefined);
  } else {
    const num = Number(value);
    return isFinite(num) ? num : undefined;
  }
};

const calculateBoxPlotStats = (arr: number[]): { min: number; q1: number; median: number; q3: number; max: number; iqr: number; whiskerLow: number; whiskerHigh: number; } | null => {
  if (!arr || arr.length === 0) return null;
  const sortedArr = [...arr].sort((a, b) => a - b);
  
  const percentile = (p: number) => {
    const pos = (sortedArr.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedArr[base + 1] !== undefined) {
      return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
    } else {
      return sortedArr[base];
    }
  };

  const min = sortedArr[0];
  const max = sortedArr[sortedArr.length - 1];
  const q1 = percentile(0.25);
  const median = percentile(0.5);
  const q3 = percentile(0.75);
  const iqr = q3 - q1;

  // Standard definition for whiskers
  const lowerWhiskerCandidate = q1 - 1.5 * iqr;
  const upperWhiskerCandidate = q3 + 1.5 * iqr;

  const whiskerLow = Math.max(min, sortedArr.find(val => val >= lowerWhiskerCandidate) ?? min);
  const whiskerHigh = Math.min(max, [...sortedArr].reverse().find(val => val <= upperWhiskerCandidate) ?? max);
  
  return { min, q1, median, q3, max, iqr, whiskerLow, whiskerHigh };
};


const DetailedDistributionModal: FC<DetailedDistributionModalProps> = ({ isOpen, onClose, data }) => {
  const [selectedDistributionChart, setSelectedDistributionChart] = useState<'histogram' | 'violin'>('histogram');

  const numericValuesForDistribution = useMemo(() => {
    if (!data || !data.rawPoints || !data.metricKey || !data.metricConfig || data.metricConfig.isString) {
      return null;
    }
    return data.rawPoints
      .map(point => getMetricValueFromPoint(point, data.metricKey, data.metricConfig))
      .filter((v): v is number => typeof v === 'number' && isFinite(v));
  }, [data]);

  const histogramData = useMemo(() => {
    if (!numericValuesForDistribution || numericValuesForDistribution.length < 1 || !data?.metricConfig) { 
      return null;
    }

    const values = numericValuesForDistribution;
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);

    if (dataMin === dataMax) { 
      return [{ range: `${dataMin.toFixed(2)} ${data.metricConfig.unit || ''}`, count: values.length, min: dataMin, max: dataMax }];
    }

    const numBins = Math.min(15, Math.max(5, Math.floor(Math.sqrt(values.length))));
    const binWidth = (dataMax - dataMin) / numBins;

    if (binWidth <= 0) { 
        return [{ range: `${dataMin.toFixed(1)}-${dataMax.toFixed(1)}`, count: values.length, min: dataMin, max: dataMax }];
    }

    const bins = Array(numBins).fill(0).map((_, i) => {
      const binStart = dataMin + i * binWidth;
      const binEnd = dataMin + (i + 1) * binWidth;
      return {
        range: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
        min: binStart,
        max: binEnd,
        count: 0,
      };
    });

    values.forEach(value => {
      for (let i = 0; i < bins.length; i++) {
        if (value >= bins[i].min && (value < bins[i].max || (i === bins.length - 1 && value <= bins[i].max + 0.00001))) {
          bins[i].count++;
          break;
        }
      }
    });
    return bins.filter(bin => bin.count > 0 || bins.length ===1);
  }, [numericValuesForDistribution, data?.metricConfig]);
  
  const boxPlotStats = useMemo(() => {
    if (!numericValuesForDistribution || numericValuesForDistribution.length === 0) return null;
    return calculateBoxPlotStats(numericValuesForDistribution);
  }, [numericValuesForDistribution]);

  const violinPlotDataForArea = useMemo(() => {
    if (!numericValuesForDistribution || numericValuesForDistribution.length < 1 || !data?.metricConfig || !boxPlotStats) { 
      return null;
    }
    const values = numericValuesForDistribution;
    const dataMin = boxPlotStats.min; 
    const dataMax = boxPlotStats.max;
    
    const numBins = 20; 
    let binWidth = (dataMax - dataMin) / numBins;

    if (dataMin === dataMax) { 
        binWidth = 1; 
         return [{ y: dataMin, densityLeft: -1, densityRight: 1 }]; 
    }
    if (binWidth <= 0) {
        return null; 
    }
    
    let bins: { yMin: number; yMax: number; yMid: number; count: number }[];

    bins = Array(numBins).fill(null).map((_, i) => {
      const yMin = dataMin + i * binWidth;
      const yMax = dataMin + (i + 1) * binWidth;
      return {
        yMin,
        yMax,
        yMid: (yMin + yMax) / 2,
        count: 0,
      };
    });

    values.forEach(value => {
      for (let i = 0; i < bins.length; i++) {
        if (value >= bins[i].yMin && (value < bins[i].yMax || (i === bins.length - 1 && value <= bins[i].yMax + 0.00001))) { 
          bins[i].count++;
          break;
        }
      }
    });
    
    const maxCount = Math.max(...bins.map(b => b.count), 0);
    if (maxCount === 0 && values.length > 0) { 
        return [{ y: boxPlotStats.median, densityLeft: -0.5, densityRight: 0.5 }];
    }
    if (maxCount === 0) return null;

    return bins.map(bin => ({
      y: bin.yMid,
      densityLeft: - (bin.count / maxCount), 
      densityRight: (bin.count / maxCount),  
    }));

  }, [numericValuesForDistribution, data?.metricConfig, boxPlotStats]);


  const violinYAxisDomain = useMemo(() => {
    if (!boxPlotStats) return ['auto', 'auto'];
    const range = boxPlotStats.max - boxPlotStats.min;
    const padding = range > 0 ? range * 0.1 : Math.abs(boxPlotStats.min) * 0.1 || 1; 
    return [boxPlotStats.min - padding, boxPlotStats.max + padding];
  }, [boxPlotStats]);

  const canShowDistributionPlots = numericValuesForDistribution && numericValuesForDistribution.length > 0;
  const CHART_HEIGHT = 350; 
  const FIXED_CHART_WIDTH = 450; 
  const FIXED_CHART_HEIGHT = 300; 


  // LOGGING START
  console.log('[DetailedDistributionModal] Rendering. isOpen:', isOpen);
  if (data) {
    console.log('[DetailedDistributionModal] Data props:', {
      metricKey: data.metricKey,
      metricName: data.metricConfig.name,
      aggregationLabel: data.aggregationLabel,
      stats: data.stats,
      rawPointsCount: data.rawPoints.length,
    });
    console.log('[DetailedDistributionModal] numericValuesForDistribution (count, sample):', 
      numericValuesForDistribution?.length, 
      numericValuesForDistribution?.slice(0,5)
    );
    console.log('[DetailedDistributionModal] histogramData:', histogramData);
    console.log('[DetailedDistributionModal] boxPlotStats:', boxPlotStats);
    console.log('[DetailedDistributionModal] violinPlotDataForArea:', violinPlotDataForArea);
    console.log('[DetailedDistributionModal] canShowDistributionPlots:', canShowDistributionPlots);
  } else {
    console.log('[DetailedDistributionModal] Data prop is null or undefined.');
  }
  // LOGGING END

  if (!isOpen || !data) {
    return null;
  }

  const { metricKey, metricConfig, aggregationLabel, stats, rawPoints } = data;

  const violinPrimaryColor = metricConfig.color || 'hsl(var(--primary))';
  const violinFillColor = `hsla(var(--primary-hsl), 0.3)`; // Assuming primary color has an HSL var

  // Extract HSL values from the primary color string for dynamic opacity
  let primaryHslValues = "210 75% 50%"; // Default fallback
  if (violinPrimaryColor.startsWith('hsl(var(--chart-')) {
      // This requires globals.css to have --chart-X-hsl vars or similar
      // For now, we'll use a fallback or assume a specific chart var
      const chartVarMatch = violinPrimaryColor.match(/--chart-(\d)/);
      if (chartVarMatch && chartVarMatch[1]) {
          const chartNum = chartVarMatch[1];
          // This is tricky as we can't directly read CSS vars in JS easily.
          // We'll use a fallback or predefined HSL values for chart colors.
          // Example for chart-1:
          if (chartNum === '1') primaryHslValues = "210 75% 50%"; // --chart-1 HSL
          else if (chartNum === '2') primaryHslValues = "180 60% 50%"; // --chart-2 HSL
          // Add more cases if other chart colors are used for violin
      }
  } else if (violinPrimaryColor.startsWith('hsl(var(--primary')) {
       primaryHslValues = "210 75% 50%"; // --primary HSL
  }
  const dynamicViolinFillColor = `hsla(${primaryHslValues.split(' ')[0]}, ${primaryHslValues.split(' ')[1]}, ${primaryHslValues.split(' ')[2].replace('%','')*0.8}%, 0.3)`;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">
            Detailed View: {metricConfig.name}
          </DialogTitle>
          <DialogDescription>
            Distribution analysis for the aggregation period: {aggregationLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 flex-shrink-0">
            <Card>
                <CardHeader className="pb-2 pt-4">
                    <ModalCardTitle className="text-md font-semibold">Summary Statistics</ModalCardTitle>
                </CardHeader>
                <CardContent className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                    {stats.avg !== undefined && (
                        <div className="flex justify-between"><span>Average:</span> <span className="font-semibold text-primary">{stats.avg.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {boxPlotStats?.median !== undefined && (
                        <div className="flex justify-between"><span>Median:</span> <span className="font-semibold text-primary">{boxPlotStats.median.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {boxPlotStats?.q1 !== undefined && (
                        <div className="flex justify-between"><span>Q1:</span> <span className="font-semibold text-primary">{boxPlotStats.q1.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                     {boxPlotStats?.q3 !== undefined && (
                        <div className="flex justify-between"><span>Q3:</span> <span className="font-semibold text-primary">{boxPlotStats.q3.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.min !== undefined && (
                         <div className="flex justify-between"><span>Min:</span> <span className="font-semibold text-primary">{stats.min.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.max !== undefined && (
                         <div className="flex justify-between"><span>Max:</span> <span className="font-semibold text-primary">{stats.max.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.stdDev !== undefined && (
                         <div className="flex justify-between col-span-2"><span>Std. Dev:</span> <span className="font-semibold text-primary">{stats.stdDev.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.count !== undefined && (
                         <div className="flex justify-between col-span-2"><span>Data Points:</span> <span className="font-semibold text-primary">{stats.count}</span></div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2 pt-4">
                    <ModalCardTitle className="text-md font-semibold">
                        Value Distribution
                    </ModalCardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Tabs defaultValue="histogram" onValueChange={(value) => setSelectedDistributionChart(value as 'histogram' | 'violin')} className="w-full pt-2">
                        <TabsList className="grid w-full grid-cols-2 mb-1 px-2">
                            <TabsTrigger value="histogram" className="text-xs h-8">Histogram</TabsTrigger>
                            <TabsTrigger value="violin" className="text-xs h-8">Violin Plot</TabsTrigger>
                        </TabsList>
                        <TabsContent value="histogram" className={`min-h-[${CHART_HEIGHT}px] p-0 pr-4 pb-2 mt-0 flex items-center justify-center`}>
                            {(() => {
                              const showHistogram = canShowDistributionPlots && histogramData && histogramData.length > 0;
                              console.log('[DetailedDistributionModal] Show Histogram condition:', showHistogram);
                              if (showHistogram) {
                                return (
                                  <BarChart 
                                    width={FIXED_CHART_WIDTH} 
                                    height={FIXED_CHART_HEIGHT} 
                                    data={histogramData} 
                                    margin={{ top: 5, right: 0, left: -10, bottom: 20 }}
                                  >
                                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                      <XAxis dataKey="range" angle={-30} textAnchor="end" height={50} tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(histogramData.length / 7) -1)} />
                                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 0, style: {fontSize: '10px', fill: 'hsl(var(--muted-foreground))'} }}/>
                                      <Tooltip
                                          formatter={(value: number) => [`${value} points`, 'Count']}
                                          labelFormatter={(label: string) => `Range: ${label} ${metricConfig.unit || ''}`}
                                          cursor={{fill: 'hsl(var(--accent) / 0.3)'}}
                                      />
                                      <Bar dataKey="count" fill={metricConfig.color || 'hsl(var(--primary))'} radius={[2, 2, 0, 0]} />
                                  </BarChart>
                                );
                              } else {
                                console.log('[DetailedDistributionModal] Histogram not shown. Details:', {
                                  canShowDistributionPlots,
                                  histogramDataLength: histogramData?.length,
                                  isString: data?.metricConfig?.isString,
                                });
                                return (
                                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                      {metricConfig.isString ? "Histogram not applicable for textual data." : "Not enough data or variation for histogram."}
                                  </div>
                                );
                              }
                            })()}
                        </TabsContent>
                        <TabsContent value="violin" className={`min-h-[${CHART_HEIGHT}px] p-0 pr-1 pb-2 mt-0 flex items-center justify-center`}>
                           {(() => {
                              const showViolin = canShowDistributionPlots && violinPlotDataForArea && violinPlotDataForArea.length > 0 && boxPlotStats;
                              console.log('[DetailedDistributionModal] Show Violin condition (boolean):', !!showViolin);
                              if (showViolin) {
                                return (
                                  <AreaChart 
                                    width={FIXED_CHART_WIDTH} 
                                    height={FIXED_CHART_HEIGHT}
                                    data={violinPlotDataForArea}
                                    margin={{ top: 10, right: 20, bottom: 20, left: 0 }} 
                                  >
                                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                      <XAxis 
                                          type="number" 
                                          domain={[-1.1, 1.1]} 
                                          tickFormatter={(val) => val.toFixed(1)} 
                                          label={{ value: 'Density (Normalized)', position: 'insideBottom', offset: -10, style: {fontSize: '10px', fill: 'hsl(var(--muted-foreground))'} }}
                                          tick={{ fontSize: 9 }}
                                          axisLine={false}
                                          tickLine={false}
                                      />
                                      <YAxis 
                                          type="number" 
                                          dataKey="y" 
                                          domain={violinYAxisDomain} 
                                          allowDecimals 
                                          tick={{ fontSize: 10 }} 
                                          width={50}
                                          tickFormatter={(value) => Number(value).toFixed(metricConfig?.unit === 'ppm' ? 0 : 1)}
                                          label={{ value: metricConfig.unit || metricConfig.name, angle: -90, position: 'insideLeft', offset: 10, style: {fontSize: '10px', fill: 'hsl(var(--muted-foreground))'} }}
                                      />
                                      <Tooltip
                                          formatter={(value: number, name: string, props: any) => {
                                              if (name === 'densityLeft' || name === 'densityRight') {
                                                  return [`${(Math.abs(value) * 100).toFixed(1)}% relative density`, `Value: ${props.payload.y.toFixed(2)} ${metricConfig.unit || ''}`];
                                              }
                                              return [value, name];
                                          }}
                                          labelFormatter={(label, payload) => {
                                              if (payload && payload.length > 0 && payload[0]?.payload?.y !== undefined) {
                                                  return `Value: ${Number(payload[0].payload.y).toFixed(2)} ${metricConfig.unit || ''}`;
                                              }
                                              return '';
                                          }}
                                          itemSorter={(item) => item.name === 'densityRight' ? 1 : -1} 
                                          cursor={{ stroke: 'hsl(var(--accent))', strokeDasharray: '3 3' }}
                                      />
                                      <Area type="monotone" dataKey="densityRight" strokeWidth={1} stroke={violinPrimaryColor} fill={dynamicViolinFillColor} fillOpacity={0.7} stackId="1" name="Density (Right)" />
                                      <Area type="monotone" dataKey="densityLeft" strokeWidth={1} stroke={violinPrimaryColor} fill={dynamicViolinFillColor} fillOpacity={0.7} stackId="1" name="Density (Left)" />
                                      
                                      {boxPlotStats && (
                                        <>
                                            <ReferenceLine y={boxPlotStats.median} stroke="hsl(var(--foreground))" strokeWidth={1.5} strokeOpacity={0.9} ifOverflow="visible">
                                                <YAxis.Label value="Median" offset={5} position="right" style={{fontSize: '9px', fill: 'hsl(var(--foreground))'}} className="recharts-label"/>
                                            </ReferenceLine>
                                            <ReferenceLine y={boxPlotStats.q1} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="2 2" strokeOpacity={0.7} ifOverflow="visible">
                                                 <YAxis.Label value="Q1" offset={5} position="right" style={{fontSize: '9px', fill: 'hsl(var(--muted-foreground))'}} className="recharts-label"/>
                                            </ReferenceLine>
                                            <ReferenceLine y={boxPlotStats.q3} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="2 2" strokeOpacity={0.7} ifOverflow="visible">
                                                 <YAxis.Label value="Q3" offset={5} position="right" style={{fontSize: '9px', fill: 'hsl(var(--muted-foreground))'}} className="recharts-label"/>
                                            </ReferenceLine>
                                            <ReferenceLine y={boxPlotStats.whiskerLow} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.6} ifOverflow="visible">
                                              <YAxis.Label value="Whisker" offset={5} position="right" style={{fontSize: '9px', fill: 'hsl(var(--border))'}} className="recharts-label"/>
                                            </ReferenceLine>
                                            <ReferenceLine y={boxPlotStats.whiskerHigh} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.6} ifOverflow="visible"/>
                                        </>
                                      )}
                                  </AreaChart>
                                );
                              } else {
                                console.log('[DetailedDistributionModal] Violin Plot not shown. Details:', {
                                  canShowDistributionPlots,
                                  violinPlotDataForAreaExists: !!violinPlotDataForArea,
                                  violinPlotDataLength: violinPlotDataForArea?.length,
                                  boxPlotStatsExists: !!boxPlotStats,
                                  isString: data?.metricConfig?.isString,
                                });
                                 return (
                                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                      {metricConfig.isString ? "Violin plot not applicable for textual data." : "Not enough data or variation for violin plot."}
                                  </div>
                                );
                              }
                           })()}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>

        <div className="flex-grow overflow-hidden mt-2">
          <h4 className="text-md font-semibold mb-2 text-muted-foreground">Contributing Raw Data Points ({rawPoints.length} points):</h4>
          <ScrollArea className="h-[200px] border rounded-md"> 
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Timestamp (UTC)</TableHead>
                  <TableHead className="text-right">Value ({metricConfig.unit || 'N/A'})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawPoints.length > 0 ? (
                  rawPoints.map((point, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">
                        {formatTimestampToFullUTC(point.timestamp)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        { metricConfig.isString
                          ? (getMetricValueFromPoint(point, metricKey, metricConfig) as string || 'N/A')
                          : (getMetricValueFromPoint(point, metricKey, metricConfig) as number | undefined)?.toFixed(metricConfig.unit === 'ppm' ? 0 : 2) ?? 'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No raw data points for this aggregate.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4 flex-shrink-0">
          <Button onClick={onClose} variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DetailedDistributionModal;
    

