// components/ArtifactCard.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Artifact } from '../types';
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface ArtifactCardProps {
  artifact: Artifact;
  className?: string;
}

const ArtifactCard: React.FC<ArtifactCardProps> = ({ artifact, className }) => {
  const { t } = useTranslation(); // Use translation hook
  return (
    <NavLink 
      to={`/artifact/${artifact.id}`} 
      className={`block rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden bg-white 
                  transform hover:-translate-y-1 hover:scale-102 border border-gray-200 ${className}`}
    >
      <div className="relative w-full h-48 overflow-hidden">
        <img 
          src={artifact.imageUrl} 
          alt={artifact.name} 
          className="w-full h-full object-cover object-center transition-transform duration-300 hover:scale-105" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <p className="text-white text-sm font-medium tracking-wide">{artifact.category}</p>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-xl font-bold text-gray-800 truncate mb-1">{artifact.name}</h3>
        <p className="text-sm text-gray-600">{artifact.artist} ({artifact.year})</p>
        <p className="text-xs text-gray-500 mt-2 flex items-center">
          <svg className="w-4 h-4 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path>
          </svg>
          {artifact.location.city}, {artifact.location.country}
        </p>
      </div>
    </NavLink>
  );
};

export default ArtifactCard;