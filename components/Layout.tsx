// components/Layout.tsx
import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t, i18n } = useTranslation(); // Use translation hook

  // Dynamically set document title based on current language
  useEffect(() => {
    document.title = t('app_title');
  }, [t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-lg p-4 sticky top-0 z-40">
        <nav className="container mx-auto flex flex-wrap items-center justify-between">
          <NavLink to="/" className="text-3xl font-extrabold hover:text-blue-200 transition-colors duration-300 tracking-wide">
            {t('app_title')}
          </NavLink>
          <div className="flex items-center space-x-6 mt-2 md:mt-0">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-lg font-medium hover:text-blue-200 transition-colors duration-300 ${
                  isActive ? 'underline underline-offset-4 decoration-2 decoration-blue-200' : ''
                }`
              }
            >
              {t('home_link')}
            </NavLink>
            <NavLink
              to="/map"
              className={({ isActive }) =>
                `text-lg font-medium hover:text-blue-200 transition-colors duration-300 ${
                  isActive ? 'underline underline-offset-4 decoration-2 decoration-blue-200' : ''
                }`
              }
            >
              {t('world_map_link')}
            </NavLink>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `text-lg font-medium hover:text-blue-200 transition-colors duration-300 ${
                  isActive ? 'underline underline-offset-4 decoration-2 decoration-blue-200' : ''
                }`
              }
            >
              {t('admin_link')}
            </NavLink>

            {/* Language Switcher */}
            <div className="relative">
              <select
                onChange={(e) => changeLanguage(e.target.value)}
                value={i18n.language}
                aria-label="Select language"
                className="block appearance-none w-full bg-blue-600 border border-blue-500 text-white py-2 px-3 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm cursor-pointer"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="ml">മലയാളം (Malayalam)</option>
                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>
        </nav>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;