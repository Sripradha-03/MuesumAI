// components/ErrorMessage.tsx
import React from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface ErrorMessageProps {
  // Fix: Update message prop to accept React.ReactNode to allow for JSX content
  message: React.ReactNode;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  const { t } = useTranslation(); // Use translation hook
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong className="font-bold mr-2">{t('error_text')}</strong>
      <span className="block sm:inline">{message}</span>
    </div>
  );
};

export default ErrorMessage;