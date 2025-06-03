
import type { FC } from 'react';
import type { LucideProps } from 'lucide-react';
import { CloudRain, Thermometer, Droplets, SunDim, Wind, AlertTriangle, HelpCircle, Gauge } from 'lucide-react';
import type { MetricKey } from '@/types/weather';

interface MetricIconProps extends Omit<LucideProps, 'color'> {
  metric: MetricKey | 'alert' | 'unknown';
  isAlerting?: boolean;
}

const iconMap: Record<MetricKey | 'alert' | 'unknown', React.ElementType> = {
  precipitation: CloudRain,
  temperature: Thermometer,
  humidity: Droplets,
  lux: SunDim,
  airQualityIndex: Wind,
  pressure: Gauge,
  alert: AlertTriangle,
  unknown: HelpCircle,
};

const MetricIcon: FC<MetricIconProps> = ({ metric, className, isAlerting, ...props }) => {
  const IconComponent = iconMap[metric] || iconMap.unknown;
  const colorClass = isAlerting ? 'text-destructive' : 'text-accent';

  return <IconComponent className={`${colorClass} ${className || ''}`} {...props} />;
};

export default MetricIcon;
