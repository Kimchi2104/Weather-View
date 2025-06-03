import type { FC } from 'react';
import type { LucideProps } from 'lucide-react';
import { CloudRain, Thermometer, Droplets, SunDim, Wind, AlertTriangle } from 'lucide-react';
import type { MetricKey } from '@/types/weather';

interface MetricIconProps extends Omit<LucideProps, 'color'> {
  metric: MetricKey | 'alert';
  isAlerting?: boolean;
}

const iconMap: Record<MetricKey | 'alert', React.ElementType> = {
  precipitation: CloudRain,
  temperature: Thermometer,
  humidity: Droplets,
  lightPollution: SunDim,
  airQualityIndex: Wind,
  alert: AlertTriangle,
};

const MetricIcon: FC<MetricIconProps> = ({ metric, className, isAlerting, ...props }) => {
  const IconComponent = iconMap[metric];
  const colorClass = isAlerting ? 'text-destructive' : 'text-accent';

  if (!IconComponent) return null;

  return <IconComponent className={`${colorClass} ${className || ''}`} {...props} />;
};

export default MetricIcon;
