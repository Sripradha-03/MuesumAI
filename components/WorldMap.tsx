import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Artifact, AnalyticsEventType } from '../types';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import { useAnalytics } from '../context/AnalyticsContext'; // Import useAnalytics
import { useArtifacts } from '../context/ArtifactsContext'; // Import useArtifacts
import { useTranslation } from 'react-i18next'; // Import useTranslation
import L from 'leaflet'; // Import Leaflet

// Define a custom icon for Leaflet markers
const artifactIcon = L.icon({
  iconUrl: 'data:image/svg+xml;utf-8,' + encodeURIComponent(`
    <svg width="30" height="30" viewBox="0 0 24 24" fill="#6366F1" stroke="white" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="10" r="3"></circle>
      <path d="M12 21.7C17.3 17 22 13.5 22 10.2A7.7 7.7 0 0 0 12 2a7.7 7.7 0 0 0-10 8.2C2 13.5 6.7 17 12 21.7z"></path>
    </svg>
  `),
  iconSize: [30, 30], // size of the icon
  iconAnchor: [15, 30], // point from which the icon will be centered
  popupAnchor: [0, -30] // point to display the popup relative to the icon
});

interface WorldMapProps {
  defaultCenter?: [number, number]; // [lat, lng]
  defaultZoom?: number;
}

const WorldMap: React.FC<WorldMapProps> = ({
  defaultCenter = [0, 0], // Default to center of the world
  defaultZoom = 1, // Default zoom level
}) => {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const { trackEvent } = useAnalytics(); // Use analytics context
  const { artifacts } = useArtifacts(); // Get artifacts from context
  const { t } = useTranslation(); // Use translation hook

  useEffect(() => {
    let markers: L.Marker[] = [];

    const initMap = () => {
      // Check if Leaflet is available globally, which it should be via CDN in index.html
      if (!window.L) {
        setMapError(t('error_map_api_not_loaded'));
        return;
      }
      
      if (mapRef.current && !leafletMap.current) {
        // Initialize map
        leafletMap.current = L.map(mapRef.current, {
          center: defaultCenter, // Leaflet expects [lat, lng]
          zoom: defaultZoom,
          minZoom: 1, // Prevent zooming out too far
          maxBounds: [
            [-90, -180],
            [90, 180]
          ], // Restrict map to world bounds
          attributionControl: false // Disable default Leaflet attribution for custom placement
        });

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
          noWrap: true // Prevent map from repeating horizontally
        }).addTo(leafletMap.current);

        // Custom Attribution Control (bottom right)
        L.control.attribution({
            position: 'bottomright',
            prefix: false // Don't show "Leaflet" prefix
        }).addAttribution('&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors').addTo(leafletMap.current);


        artifacts.forEach((artifact) => {
          const marker = L.marker([artifact.location.lat, artifact.location.lng], {
            icon: artifactIcon,
            title: artifact.name
          }).addTo(leafletMap.current!);
          markers.push(marker); // Store marker for cleanup

          marker.on('click', () => {
            navigate(`/artifact/${artifact.id}`);
          });

          // Create a popup for hover effect
          const popupContent = `
            <div style="padding: 10px; font-family: sans-serif; max-width: 200px;">
              <img src="${artifact.imageUrl}" alt="${artifact.name}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;">
              <h4 style="margin: 0 0 5px 0; font-size: 1.1em; font-weight: bold; color: #333;">${artifact.name}</h4>
              <p style="margin: 0 0 3px 0; font-size: 0.9em; color: #555;">${artifact.artist}</p>
              <p style="margin: 0; font-size: 0.8em; color: #777;">${artifact.location.city}, ${artifact.location.country}</p>
              <a href="#/artifact/${artifact.id}" style="color: #2563EB; text-decoration: none; font-size: 0.9em; margin-top: 8px; display: inline-block; font-weight: 500;">${t('view_details_link')} &rarr;</a>
            </div>
          `;

          marker.bindPopup(popupContent, {
            closeButton: false,
            autoPan: false // Prevent map pan on hover popup
          });

          marker.on('mouseover', () => marker.openPopup());
          marker.on('mouseout', () => marker.closePopup());
        });
        setMapLoaded(true);
        trackEvent(AnalyticsEventType.MAP_VIEW, { status: 'loaded', center: defaultCenter, zoom: defaultZoom });
      }
    };

    // Attempt to initialize map immediately if Leaflet is ready
    if (window.L) {
      initMap();
    } else {
      // Fallback if Leaflet isn't immediately available (though it should be via CDN)
      setMapLoaded(false);
      const timeoutId = window.setTimeout(() => {
        if (window.L) {
          initMap();
        } else {
          setMapError(t('error_map_api_timeout'));
          trackEvent(AnalyticsEventType.MAP_VIEW, { status: 'failed', reason: 'timeout' });
        }
      }, 5000); // Wait up to 5 seconds for Leaflet to load
      return () => clearTimeout(timeoutId);
    }

    return () => {
      if (leafletMap.current) {
        // Remove all markers
        markers.forEach(marker => {
          marker.off('click'); // Remove event listener
          marker.off('mouseover');
          marker.off('mouseout');
          leafletMap.current?.removeLayer(marker);
        });
        markers = [];
        leafletMap.current.remove(); // Remove map instance from DOM
        leafletMap.current = null;
      }
      setMapLoaded(false);
      setMapError(null);
    };
  }, [artifacts, defaultCenter, defaultZoom, navigate, trackEvent, t]); // Added t to dependencies

  if (mapError) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorMessage message={mapError} />
      </div>
    );
  }

  if (!mapLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner message={t('loading_world_map')} />
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg shadow-lg border border-gray-200"
      aria-label={t('explore_artifacts_map_title')}
      role="region"
    >
      {/* Leaflet Map will render here */}
    </div>
  );
};

export default WorldMap;