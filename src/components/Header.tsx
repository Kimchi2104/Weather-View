import type { FC } from 'react';
import { Zap } from 'lucide-react';

const Header: FC = () => {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center">
        <Zap size={32} className="mr-3 text-accent" />
        <h1 className="text-3xl font-headline font-semibold">WeatherView</h1>
      </div>
    </header>
  );
};

export default Header;
