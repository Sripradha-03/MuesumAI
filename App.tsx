// App.tsx
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ScanButton from './components/ScanButton';
import ConsentBanner from './components/ConsentBanner';
import HomePage from './pages/HomePage';
import ArtifactDetailPage from './pages/ArtifactDetailPage';
import WorldMapPage from './pages/WorldMapPage';
import AdminPage from './pages/AdminPage'; // New: Import AdminPage
import { AnalyticsProvider } from './context/AnalyticsContext';
import { ArtifactsProvider } from './context/ArtifactsContext'; // New: Import ArtifactsProvider
import { I18nextProvider } from 'react-i18next'; // Import I18nextProvider
import i18n from './i18n'; // Import i18n configuration

const App: React.FC = () => {
  return (
    <AnalyticsProvider>
      <ArtifactsProvider>
        <I18nextProvider i18n={i18n}> {/* Wrap with I18nextProvider */}
          <HashRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/artifact/:id" element={<ArtifactDetailPage />} />
                <Route path="/map" element={<WorldMapPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </Layout>
            <ScanButton />
            <ConsentBanner />
          </HashRouter>
        </I18nextProvider>
      </ArtifactsProvider>
    </AnalyticsProvider>
  );
};

export default App;