// pages/HomePage.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import ArtifactCard from '../components/ArtifactCard';
import { useArtifacts } from '../context/ArtifactsContext'; // Import useArtifacts
import { useTranslation } from 'react-i18next'; // Import useTranslation

const HomePage: React.FC = () => {
  const { artifacts } = useArtifacts(); // Get artifacts from context
  const featuredArtifacts = artifacts.slice(0, 3); // Display a few featured artifacts
  const { t } = useTranslation(); // Use translation hook

  return (
    <div className="text-center p-6 bg-white rounded-lg shadow-xl">
      <h1 className="text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
        {t('welcome_title', { appName: t('app_title') })}
      </h1>
      <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
        {t('welcome_message')}
      </p>

      <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
        <NavLink
          to="/map"
          className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition duration-300 ease-in-out"
        >
          {t('explore_map_button')}
        </NavLink>
        <NavLink
          to="/admin"
          className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition duration-300 ease-in-out"
        >
          {t('admin_panel_button')}
        </NavLink>
      </div>

      <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-blue-600 pb-2 inline-block">{t('featured_artifacts_title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {featuredArtifacts.map(artifact => (
          <ArtifactCard key={artifact.id} artifact={artifact} />
        ))}
      </div>
    </div>
  );
};

export default HomePage;