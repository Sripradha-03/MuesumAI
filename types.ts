// types.ts

export interface ArtifactLocation {
  lat: number;
  lng: number;
  city: string;
  country: string;
}

export interface Artifact {
  id: string;
  name: string;
  artist: string;
  year: string;
  initialDescription: string;
  imageUrl: string;
  location: ArtifactLocation;
  videoUrl?: string;
  audioUrl?: string;
  category: string;
  materials: string[];
  dimensions: string;
  museum: string;
}

export enum AnalyticsEventType {
  PAGE_VIEW = 'page_view',
  ARTIFACT_SCANNED = 'artifact_scanned',
  AI_INSIGHT_VIEWED = 'ai_insight_viewed',
  RECOMMENDATION_VIEWED = 'recommendation_viewed',
  VIDEO_PLAY = 'video_play',
  AUDIO_PLAY = 'audio_play',
  MAP_VIEW = 'map_view',
  PRIVACY_CONSENT_GIVEN = 'privacy_consent_given',
  PRIVACY_OPT_OUT = 'privacy_opt_out',
  TIME_SPENT_SEARCH = 'time_spent_search',
  TIME_SPENT_VIEWING_ARTIFACT = 'time_spent_viewing_artifact',
}

export interface AnalyticsEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  eventType: AnalyticsEventType;
  eventData?: Record<string, any>;
  duration?: number; // For events like TIME_SPENT_SEARCH
}

export interface GenerateContentPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

// Global declarations for Google Maps API were removed as Leaflet.js is now used.
// If you use any specific Leaflet features that require global type augmentation,
// you would add them here. For basic usage, it's often not strictly necessary
// if Leaflet is loaded via a script tag.

// Extend the Window interface to properly include the global L object from Leaflet
declare global {
  interface Window {
    L: any; // Leaflet global object
  }
}
