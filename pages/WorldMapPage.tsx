// pages/WorldMapPage.tsx
import React, { useEffect } from 'react';
import WorldMap from '../components/WorldMap';
import { useAnalytics } from '../context/AnalyticsContext';
import { AnalyticsEventType } from '../types';
import { useTranslation } from 'react-i18next'; // Import useTranslation

const WorldMapPage: React.FC = () => {
  const { trackEvent } = useAnalytics();
  const { t } = useTranslation(); // Use translation hook

  useEffect(() => {
    trackEvent(AnalyticsEventType.MAP_VIEW);
  }, [trackEvent]);

  return (
    <div className="p-4 md:p-8 bg-white rounded-lg shadow-xl min-h-[70vh] flex flex-col border border-gray-200">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
        {t('explore_artifacts_map_title')}
      </h1>
      <div className="flex-grow"> {/* Added flex-grow to ensure map takes available space */}
        <WorldMap defaultZoom={1.5} /> {/* Removed artifacts prop */}
      </div>
    </div>
  );
};

export default WorldMapPage;