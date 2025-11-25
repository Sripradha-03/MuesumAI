// components/LoadingSpinner.tsx
import React from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface LoadingSpinnerProps {
  message?: string;
  small?: boolean; // New prop for smaller spinner
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, small = false }) => {
  const { t } = useTranslation(); // Use translation hook
  const spinnerClasses = small ? 'w-4 h-4 border-2' : 'w-12 h-12 border-4';
  const textClasses = small ? 'text-sm mt-0 ml-2' : 'mt-4 text-lg';

  // Use the default message from translation if not provided
  const displayMessage = message !== undefined ? message : t('loading_text');

  return (
    <div className={`flex items-center ${small ? 'justify-center' : 'flex-col justify-center p-4'} text-gray-700`}>
      <div className={`${spinnerClasses} border-blue-500 rounded-full animate-spin`}></div>
      {displayMessage && <p className={`${textClasses} font-medium`}>{displayMessage}</p>}
    </div>
  );
};

export default LoadingSpinner;