// context/AnalyticsContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AnalyticsEvent, AnalyticsEventType } from '../types';
import { uuidv4 } from '../utils/helpers';

interface AnalyticsContextType {
  sessionId: string;
  analyticsEnabled: boolean;
  trackEvent: (eventType: AnalyticsEventType, eventData?: Record<string, any>, duration?: number) => void;
  startTimer: (id: string) => void;
  endTimer: (id: string, eventType: AnalyticsEventType, eventData?: Record<string, any>) => void;
  toggleAnalytics: (enable: boolean) => void;
  clearAnalyticsData: () => void;
  getAnalyticsData: () => AnalyticsEvent[];
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

const SESSION_ID_KEY = 'museum_explorer_session_id';
const ANALYTICS_CONSENT_KEY = 'museum_explorer_analytics_consent';
const ANALYTICS_DATA_KEY = 'museum_explorer_analytics_data';
const MAX_ANALYTICS_EVENTS = 100; // Keep a reasonable number of events in local storage

export const AnalyticsProvider: React.FC<AnalyticsProviderProps> = ({ children }) => {
  const [sessionId] = useState<string>(() => {
    let storedSessionId = localStorage.getItem(SESSION_ID_KEY);
    if (!storedSessionId) {
      storedSessionId = uuidv4();
      localStorage.setItem(SESSION_ID_KEY, storedSessionId);
    }
    return storedSessionId;
  });

  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean>(() => {
    const consent = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return consent === 'true'; // Default to false if not explicitly true
  });

  const analyticsDataRef = useRef<AnalyticsEvent[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  // Load existing analytics data on mount
  useEffect(() => {
    if (analyticsEnabled) {
      const storedData = localStorage.getItem(ANALYTICS_DATA_KEY);
      if (storedData) {
        try {
          analyticsDataRef.current = JSON.parse(storedData);
        } catch (e) {
          console.error("Failed to parse analytics data from localStorage", e);
          analyticsDataRef.current = [];
        }
      }
    } else {
      analyticsDataRef.current = []; // Clear in-memory data if analytics disabled
    }
  }, [analyticsEnabled]);

  const saveAnalyticsData = useCallback(() => {
    if (analyticsEnabled) {
      // Trim to MAX_ANALYTICS_EVENTS before saving
      const dataToSave = analyticsDataRef.current.slice(-MAX_ANALYTICS_EVENTS);
      localStorage.setItem(ANALYTICS_DATA_KEY, JSON.stringify(dataToSave));
    } else {
      localStorage.removeItem(ANALYTICS_DATA_KEY); // Clear data if analytics disabled
    }
  }, [analyticsEnabled]);

  // Save data to localStorage periodically or on component unmount
  useEffect(() => {
    const interval = setInterval(saveAnalyticsData, 60000); // Save every minute
    return () => {
      clearInterval(interval);
      saveAnalyticsData(); // Save on unmount
    };
  }, [saveAnalyticsData]);

  const trackEvent = useCallback((eventType: AnalyticsEventType, eventData?: Record<string, any>, duration?: number) => {
    if (!analyticsEnabled) return;

    const event: AnalyticsEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      sessionId: sessionId,
      eventType: eventType,
      eventData: eventData,
      duration: duration,
    };
    analyticsDataRef.current.push(event);
  }, [analyticsEnabled, sessionId]);

  const startTimer = useCallback((id: string) => {
    if (!analyticsEnabled) return;
    timersRef.current.set(id, performance.now());
  }, [analyticsEnabled]);

  const endTimer = useCallback((id: string, eventType: AnalyticsEventType, eventData?: Record<string, any>) => {
    if (!analyticsEnabled) return;
    const startTime = timersRef.current.get(id);
    if (startTime !== undefined) {
      const duration = performance.now() - startTime; // in milliseconds
      trackEvent(eventType, eventData, duration);
      timersRef.current.delete(id);
    }
  }, [analyticsEnabled, trackEvent]);

  const toggleAnalytics = useCallback((enable: boolean) => {
    setAnalyticsEnabled(enable);
    localStorage.setItem(ANALYTICS_CONSENT_KEY, String(enable));
    trackEvent(enable ? AnalyticsEventType.PRIVACY_CONSENT_GIVEN : AnalyticsEventType.PRIVACY_OPT_OUT);
    if (!enable) {
      clearAnalyticsData(); // Clear all data if opted out
    }
  }, [trackEvent]);

  const clearAnalyticsData = useCallback(() => {
    analyticsDataRef.current = [];
    localStorage.removeItem(ANALYTICS_DATA_KEY);
    timersRef.current.clear();
  }, []);

  const getAnalyticsData = useCallback(() => {
    return analyticsDataRef.current;
  }, []);

  const value = {
    sessionId,
    analyticsEnabled,
    trackEvent,
    startTimer,
    endTimer,
    toggleAnalytics,
    clearAnalyticsData,
    getAnalyticsData,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};