// components/ConsentBanner.tsx
import React, { useState, useEffect } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { AnalyticsEventType } from '../types';
import { useTranslation } from 'react-i18next'; // Import useTranslation

const ANALYTICS_CONSENT_KEY = 'museum_explorer_analytics_consent';

const ConsentBanner: React.FC = () => {
  const { t } = useTranslation(); // Use translation hook
  const [showBanner, setShowBanner] = useState(false);
  const { toggleAnalytics } = useAnalytics();

  useEffect(() => {
    const consent = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (consent === null) {
      setShowBanner(true); // Show if consent not yet given
    }
  }, []);

  const handleAccept = () => {
    toggleAnalytics(true); // toggleAnalytics already tracks PRIVACY_CONSENT_GIVEN
    setShowBanner(false);
  };

  const handleDecline = () => {
    toggleAnalytics(false); // toggleAnalytics already tracks PRIVACY_OPT_OUT
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4 shadow-lg z-50 md:flex md:items-center md:justify-between">
      <p className="text-sm text-center md:text-left mb-2 md:mb-0" dangerouslySetInnerHTML={{ __html: t('privacy_banner_message') }} />
      <div className="flex justify-center md:justify-end gap-2">
        <button
          onClick={handleAccept}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out text-sm"
        >
          {t('accept_button')}
        </button>
        <button
          onClick={handleDecline}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out text-sm"
        >
          {t('decline_button')}
        </button>
      </div>
    </div>
  );
};

export default ConsentBanner;