// components/ScanButton.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fileToBase64 } from '../utils/helpers';
import { identifyImage, GEMINI_QUOTA_EXCEEDED_ERROR } from '../services/geminiService';
import { useAnalytics } from '../context/AnalyticsContext';
import { AnalyticsEventType } from '../types';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import { useArtifacts } from '../context/ArtifactsContext';
import { useTranslation } from 'react-i18next';

// Modal for camera scan
const CameraScanModal: React.FC<{
  onImageCapture: (base64Image: string, mimeType: string) => void;
  onClose: () => void;
  onError: (message: string) => void;
}> = ({ onImageCapture, onClose, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null); // To store the media stream for cleanup
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCaptureButton, setShowCaptureButton] = useState(false);
  const { t } = useTranslation();

  const onVideoCanPlay = useCallback(() => {
    const videoElement = videoRef.current;
    if (videoElement && videoElement.readyState >= 3 && !videoElement.paused) {
      setShowCaptureButton(true);
      setCameraLoading(false);
      setCameraError(null);
    }
  }, []);

  useEffect(() => {
    setCameraLoading(true);
    setCameraError(null);
    setShowCaptureButton(false);

    const setupCamera = async () => {
      const videoElement = videoRef.current;
      if (!videoElement) {
        console.warn('Video element not found during camera setup.');
        setCameraLoading(false);
        setCameraError(t('error_camera_setup_failed'));
        return;
      }

      // If a stream is already active on this video element, don't re-initialize
      if (streamRef.current && videoElement.srcObject === streamRef.current) {
        console.log('Camera already active, skipping re-initialization.');
        setCameraLoading(false);
        setShowCaptureButton(true); // Assume it's ready if already active
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream; // Store stream for later access/cleanup
        videoElement.srcObject = stream;
        videoElement.play().catch(playErr => console.error("Error playing video stream:", playErr));
        // Removed videoElement.load() as it can interrupt play() when using srcObject with MediaStream.

        videoElement.addEventListener('canplay', onVideoCanPlay);

      } catch (err: any) {
        console.error('Error accessing camera:', err);
        const errorMessage = err.name === 'NotAllowedError' ? t('error_camera_access_denied') : t('error_camera_generic', { errorMessage: err.message || 'Unknown error' });
        setCameraError(errorMessage);
        onError(errorMessage);
        setCameraLoading(false);
        onClose(); // Close modal on critical error
      }
    };

    setupCamera();

    return () => {
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.removeEventListener('canplay', onVideoCanPlay);
        videoElement.pause();
        videoElement.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setCameraLoading(false); // Ensure loading state is false on cleanup
    };
  }, [onVideoCanPlay, onClose, onError, t]);

  const handleCapture = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageDataUrl = canvas.toDataURL('image/jpeg');
      const base64Image = imageDataUrl.split(',')[1];
      onImageCapture(base64Image, 'image/jpeg');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-[100]" aria-modal="true" role="dialog">
      <div className="relative bg-white p-4 rounded-lg shadow-2xl max-w-xl w-full flex flex-col items-center">
        <h3 className="text-xl font-bold mb-4 text-gray-800" aria-label={t('use_camera_title')}>{t('use_camera_title')}</h3>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          aria-label={t('cancel_button')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
          {cameraLoading && <LoadingSpinner message={t('starting_camera_message')} />}
          {cameraError && <ErrorMessage message={cameraError} />}
          <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${cameraLoading || cameraError ? 'hidden' : ''}`} />
        </div>

        {showCaptureButton && (
          <button
            onClick={handleCapture}
            className="mt-6 flex items-center justify-center w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300"
            title={t('capture_image_button')}
            aria-label={t('capture_image_button')}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// Modal for selecting scan option (camera or file upload)
const ScanOptionsModal: React.FC<{
  onCameraOpen: () => void;
  onUpload: () => void;
  onClose: () => void;
}> = ({ onCameraOpen, onUpload, onClose }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" aria-modal="true" role="dialog">
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-sm w-full relative">
        <h3 className="text-xl font-bold mb-6 text-gray-800 text-center" aria-label={t('scan_options_title')}>{t('scan_options_title')}</h3>
        <div className="flex flex-col gap-4">
          <button
            onClick={onCameraOpen}
            className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md shadow-lg transition-colors duration-300"
            aria-label={t('use_camera_button')}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            {t('use_camera_button')}
          </button>
          <button
            onClick={onUpload}
            className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md shadow-lg transition-colors duration-300"
            aria-label={t('upload_image_button')}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            {t('upload_image_button')}
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          aria-label={t('cancel_button')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    </div>
  );
};

const ScanButton: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { startTimer, endTimer } = useAnalytics();
  const { artifacts, addArtifact } = useArtifacts();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null); // Changed to React.ReactNode
  const [showScanOptionsModal, setShowScanOptionsModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false); // New state for camera modal
  const { t } = useTranslation();

  const handleMainButtonClick = () => {
    setError(null);
    setShowScanOptionsModal(true);
  };

  const handleCloseScanOptionsModal = () => {
    setShowScanOptionsModal(false);
  };

  const handleCameraClick = () => {
    setShowScanOptionsModal(false); // Close options modal
    setShowCameraModal(true); // Open camera modal
    startTimer('artifact_scan_timer'); // Start timer for camera scan
  };

  const handleCloseCameraModal = () => {
    setShowCameraModal(false);
    endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: false, reason: 'camera_closed' });
  };

  const handleCameraError = (message: string) => {
    setError(message);
    setShowCameraModal(false); // Close camera modal if an error occurs
    endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: false, reason: 'camera_error', errorMessage: message });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
    setShowScanOptionsModal(false);
    startTimer('artifact_scan_timer');
  };

  const processImage = async (base64Image: string, mimeType: string) => {
    setIsScanning(true);
    setError(null);
    setShowCameraModal(false); // Close camera modal immediately after capture

    try {
      const identifiedArtifact = await identifyImage(base64Image, mimeType, artifacts);

      // GEMINI_QUOTA_EXCEEDED_ERROR is now THROWN, so this check moves to the catch block.
      // if (identifiedArtifact === GEMINI_QUOTA_EXCEEDED_ERROR) {
      //   setError(
      //     <div dangerouslySetInnerHTML={{ __html: t('error_ai_quota_exceeded_with_link') }} />
      //   );
      //   endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: false, reason: 'api_quota_exceeded' });
      // } else
      if (identifiedArtifact) {
        const isKnownArtifact = artifacts.some(a => a.id === identifiedArtifact.id);

        if (isKnownArtifact) {
          endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: true, artifactId: identifiedArtifact.id, type: 'known' });
          navigate(`/artifact/${identifiedArtifact.id}`);
        } else {
          addArtifact(identifiedArtifact);
          endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: true, artifactId: identifiedArtifact.id, type: 'ai_generated', name: identifiedArtifact.name });
          navigate(`/artifact/${identifiedArtifact.id}`);
        }
      } else {
        setError(t('error_unidentifiable_object'));
        endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: false, reason: 'unidentifiable' });
      }
    } catch (e: any) {
      console.error('Scan error:', e);
      if (e.message === GEMINI_QUOTA_EXCEEDED_ERROR) {
        setError(
          <div dangerouslySetInnerHTML={{ __html: t('error_ai_quota_exceeded_with_link') }} />
        );
        endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: false, reason: 'api_quota_exceeded' });
      } else {
        setError(t('error_failed_to_scan_image', { errorMessage: e.message || 'Unknown error' }));
        endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: false, reason: 'api_error', errorMessage: e.message });
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setError(t('error_no_file_selected'));
      endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: false, reason: 'no_file' });
      return;
    }

    try {
      const base64Image = await fileToBase64(file);
      await processImage(base64Image, file.type);
    } catch (e: any) {
      console.error('File processing error:', e);
      setError(t('error_failed_to_scan_image', { errorMessage: e.message || 'Unknown error' }));
      endTimer('artifact_scan_timer', AnalyticsEventType.TIME_SPENT_SEARCH, { success: false, reason: 'file_error', errorMessage: e.message });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <div className="fixed bottom-16 right-4 z-50">
        {error && (
          <div className="absolute bottom-full right-0 w-80 mb-4">
            <ErrorMessage message={error} />
          </div>
        )}
        {isScanning && (
          <div className="absolute bottom-full right-0 w-64 mb-4 bg-white p-3 rounded-lg shadow-xl">
            <LoadingSpinner message={t('scanning_artwork_message')} />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={handleMainButtonClick}
          className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300"
          title={t('scan_artifact_title')}
          aria-label={t('scan_artifact_title')}
          disabled={isScanning || showCameraModal} // Disable if camera modal is open
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
        </button>
      </div>

      {showScanOptionsModal && (
        <ScanOptionsModal
          onCameraOpen={handleCameraClick}
          onUpload={handleUploadClick}
          onClose={handleCloseScanOptionsModal}
        />
      )}

      {showCameraModal && (
        <CameraScanModal
          onImageCapture={processImage}
          onClose={handleCloseCameraModal}
          onError={handleCameraError}
        />
      )}
    </>
  );
};

export default ScanButton;