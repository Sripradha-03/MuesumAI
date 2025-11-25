// context/ArtifactsContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Artifact } from '../types';
import { INITIAL_ARTIFACTS } from '../constants';
import { uuidv4 } from '../utils/helpers';

interface ArtifactsContextType {
  artifacts: Artifact[];
  addArtifact: (newArtifact: Omit<Artifact, 'id'>) => void;
  removeArtifact: (id: string) => void;
}

const ArtifactsContext = createContext<ArtifactsContextType | undefined>(undefined);

const ARTIFACTS_STORAGE_KEY = 'art_artifacts_data';

export const ArtifactsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [artifacts, setArtifacts] = useState<Artifact[]>(() => {
    try {
      const storedArtifacts = localStorage.getItem(ARTIFACTS_STORAGE_KEY);
      if (storedArtifacts) {
        return JSON.parse(storedArtifacts);
      }
    } catch (e) {
      console.error("Failed to parse artifacts from localStorage, using initial data.", e);
    }
    return INITIAL_ARTIFACTS;
  });

  // Save artifacts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(ARTIFACTS_STORAGE_KEY, JSON.stringify(artifacts));
  }, [artifacts]);

  const addArtifact = useCallback((newArtifactData: Omit<Artifact, 'id'>) => {
    const newArtifact: Artifact = {
      ...newArtifactData,
      id: uuidv4(), // Generate a unique ID for the new artifact
    };
    setArtifacts(prev => [...prev, newArtifact]);
  }, []);

  const removeArtifact = useCallback((id: string) => {
    setArtifacts(prev => prev.filter(artifact => artifact.id !== id));
  }, []);

  const value = {
    artifacts,
    addArtifact,
    removeArtifact,
  };

  return (
    <ArtifactsContext.Provider value={value}>
      {children}
    </ArtifactsContext.Provider>
  );
};

export const useArtifacts = () => {
  const context = useContext(ArtifactsContext);
  if (context === undefined) {
    throw new Error('useArtifacts must be used within an ArtifactsProvider');
  }
  return context;
};