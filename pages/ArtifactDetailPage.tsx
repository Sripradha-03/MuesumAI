import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Artifact, AnalyticsEventType } from '../types';
import { getAiInsight, getAiRecommendations, generateSpeech, GEMINI_QUOTA_EXCEEDED_ERROR } from '../services/geminiService';
import { useAnalytics } from '../context/AnalyticsContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import ArtifactCard from '../components/ArtifactCard';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // For GitHub Flavored Markdown
import { decodeAudioData } from '../utils/helpers'; // Import decodeAudioData
import { useArtifacts } from '../context/ArtifactsContext'; // Import useArtifacts
import { useTranslation } from 'react-i18next'; // Import useTranslation

// New FallbackShareModal component
interface FallbackShareModalProps {
  artifact: Artifact;
  onClose: () => void;
  onLinkCopied: () => void;
  t: (key: string, options?: any) => string;
}

const FallbackShareModal: React.FC<FallbackShareModalProps> = ({ artifact, onClose, onLinkCopied, t }) => {
  const currentUrl = window.location.href;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      onLinkCopied();
      onClose(); // Close the modal after copying
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Optionally show a temporary error message in the modal or page
    }
  };

  const handleShareByEmail = () => {
    const subject = t('email_share_subject', { name: artifact.name });
    const body = t('email_share_body', {
      name: artifact.name,
      artist: artifact.artist,
      year: artifact.year,
      description: artifact.initialDescription,
      url: currentUrl,
    });
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" aria-modal="true" role="dialog">
      <div className="bg-white p-6 rounded-lg shadow-2xl max-w-sm w-full relative">
        <h3 className="text-xl font-bold mb-4 text-gray-800 text-center">{t('share_artifact_title')}</h3>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          aria-label={t('cancel_button')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow transition-colors duration-300"
            aria-label={t('copy_link_button')}
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3-3H9a3 3 0 01-3-3z"></path></svg>
            {t('copy_link_button')}
          </button>
          <button
            onClick={handleShareByEmail}
            className="flex items-center justify-center w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md shadow transition-colors duration-300"
            aria-label={t('share_by_email_button')}
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0018 4H2a2 2 0 00-.003 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
            {t('share_by_email_button')}
          </button>
        </div>
      </div>
    </div>
  );
};


const ArtifactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { artifacts } = useArtifacts();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Artifact[] | null>(null);
  const [loadingAiInsight, setLoadingAiInsight] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [insightError, setInsightError] = useState<React.ReactNode | null>(null);
  const [recommendationError, setRecommendationError] = useState<React.ReactNode | null>(null);

  // Text-to-Speech states
  const [isSpeakingDescription, setIsSpeakingDescription] = useState(false);
  const [isSpeakingInsight, setIsSpeakingInsight] = useState(false);
  const [speechError, setSpeechError] = useState<React.ReactNode | null>(null); // Changed to React.ReactNode

  // Share functionality states
  const [showFallbackShareModal, setShowFallbackShareModal] = useState(false);
  const [shareConfirmation, setShareConfirmation] = useState<string | null>(null); // For "Link copied!" message

  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const { trackEvent, startTimer, endTimer } = useAnalytics();
  const { t, i18n } = useTranslation();

  // Initialize AudioContext on mount, cleanup on unmount
  useEffect(() => {
    outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });

    return () => {
      if (currentAudioSourceRef.current) {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
        currentAudioSourceRef.current = null;
      }
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close().catch(e => console.error("Error closing AudioContext:", e));
        outputAudioContextRef.current = null;
      }
    };
  }, []);

  const playSpeech = useCallback(async (
    text: string,
    setSpeakingState: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (!outputAudioContextRef.current) {
      setSpeechError(t('audio_context_not_initialized'));
      return;
    }

    if (currentAudioSourceRef.current) {
      currentAudioSourceRef.current.stop();
      currentAudioSourceRef.current.disconnect();
      currentAudioSourceRef.current = null;
      setIsSpeakingDescription(false);
      setIsSpeakingInsight(false);
    }
    
    setSpeakingState(true);
    setSpeechError(null);

    try {
      const audioBytes = await generateSpeech(text);
      if (audioBytes && outputAudioContextRef.current) {
        const audioBuffer = await decodeAudioData(
          audioBytes,
          outputAudioContextRef.current,
          24000,
          1,
        );

        const source = outputAudioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContextRef.current.destination);

        source.onended = () => {
          setSpeakingState(false);
          if (currentAudioSourceRef.current === source) {
            currentAudioSourceRef.current = null;
          }
          source.disconnect();
        };

        source.start(0);
        currentAudioSourceRef.current = source;
      } else {
        setSpeechError(t('failed_to_generate_audio'));
        setSpeakingState(false);
      }
    } catch (error: any) {
      console.error('Error playing speech:', error);
      if (error.message === GEMINI_QUOTA_EXCEEDED_ERROR) {
        setSpeechError(
          <div dangerouslySetInnerHTML={{ __html: t('error_ai_quota_exceeded_with_link') }} />
        );
      } else {
        setSpeechError(t('failed_to_play_speech', { errorMessage: error.message }));
      }
      setSpeakingState(false);
    } finally {
      if (!currentAudioSourceRef.current) {
        setSpeakingState(false);
      }
    }
  }, [t]);

  const handlePlayDescription = () => {
    if (artifact?.initialDescription) {
      playSpeech(artifact.initialDescription, setIsSpeakingDescription);
    }
  };

  const handlePlayAiInsight = () => {
    if (aiInsight) {
      playSpeech(aiInsight, setIsSpeakingInsight);
    }
  };

  const handleShare = useCallback(async () => {
    if (!artifact) return;

    // Ensure the URL is absolute and canonical
    const currentAbsoluteUrl = new URL(window.location.href).href;

    const shareData = {
      title: t('share_dialog_title', { name: artifact.name }),
      text: t('share_text_template', {
        name: artifact.name,
        artist: artifact.artist,
        year: artifact.year,
        description: artifact.initialDescription.substring(0, 100) + '...', // Shorten description for share preview
      }),
      url: currentAbsoluteUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        // User successfully shared
      } catch (err) {
        console.error('Error sharing:', err); // Log the specific error
        // User cancelled sharing or other error, fallback to modal
        setShowFallbackShareModal(true);
      }
    } else {
      // Fallback for browsers that do not support navigator.share
      setShowFallbackShareModal(true);
    }
  }, [artifact, t]);

  const handleLinkCopied = useCallback(() => {
    setShareConfirmation(t('link_copied_to_clipboard'));
    setTimeout(() => setShareConfirmation(null), 3000); // Clear message after 3 seconds
  }, [t]);

  useEffect(() => {
    window.scrollTo(0, 0);

    const foundArtifact = artifacts.find(a => a.id === id);
    let activeTimerId: string | null = null;

    if (foundArtifact) {
      setArtifact(foundArtifact);
      setAiInsight(null);
      setRecommendations(null);
      setLoadingAiInsight(true);
      setLoadingRecommendations(true);
      setInsightError(null);
      setRecommendationError(null);
      setSpeechError(null);
      setIsSpeakingDescription(false);
      setIsSpeakingInsight(false);
      setShareConfirmation(null); // Clear share confirmation

      if (currentAudioSourceRef.current) {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
        currentAudioSourceRef.current = null;
      }


      activeTimerId = `artifact_view_${foundArtifact.id}`;
      startTimer(activeTimerId);
      
      trackEvent(AnalyticsEventType.PAGE_VIEW, { artifactId: foundArtifact.id, name: foundArtifact.name });

      getAiInsight(foundArtifact.name, foundArtifact.initialDescription)
        .then(insight => {
          setAiInsight(insight);
          if (insight) trackEvent(AnalyticsEventType.AI_INSIGHT_VIEWED, { artifactId: foundArtifact.id });
        })
        .catch(err => {
          console.error('Error fetching AI insight:', err);
          if (err.message === GEMINI_QUOTA_EXCEEDED_ERROR) {
            setInsightError(
              <div dangerouslySetInnerHTML={{ __html: t('error_ai_quota_exceeded_with_link') }} />
            );
          } else {
            setInsightError(t('failed_to_load_ai_insight'));
          }
        })
        .finally(() => setLoadingAiInsight(false));

      getAiRecommendations(foundArtifact, artifacts)
        .then(recs => {
          setRecommendations(recs);
          if (recs && recs.length > 0) trackEvent(AnalyticsEventType.RECOMMENDATION_VIEWED, { artifactId: foundArtifact.id, recommendations: recs.map(r => r.id) });
        })
        .catch(err => {
          console.error('Error fetching AI recommendations:', err);
          if (err.message === GEMINI_QUOTA_EXCEEDED_ERROR) {
            setRecommendationError(
              <div dangerouslySetInnerHTML={{ __html: t('error_ai_quota_exceeded_with_link') }} />
            );
          } else {
            setRecommendationError(t('failed_to_load_ai_recommendations'));
          }
        })
        .finally(() => setLoadingRecommendations(false));

    } else {
      setArtifact(null);
    }

    return () => {
      if (activeTimerId) {
        const artifactIdForCleanup = activeTimerId.split('_')[2];
        endTimer(activeTimerId, AnalyticsEventType.TIME_SPENT_VIEWING_ARTIFACT, { artifactId: artifactIdForCleanup, reason: 'cleanup' });
      }
      if (currentAudioSourceRef.current) {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
        currentAudioSourceRef.current = null;
      }
      setIsSpeakingDescription(false);
      setIsSpeakingInsight(false);
    };
  }, [id, artifacts, startTimer, endTimer, trackEvent, playSpeech, t, i18n.language]);

  if (!artifact) {
    return <ErrorMessage message={t('error_artifact_not_found')} />;
  }

  const handleVideoPlay = () => {
    trackEvent(AnalyticsEventType.VIDEO_PLAY, { artifactId: artifact.id, name: artifact.name });
  };

  const handleAudioPlay = () => {
    trackEvent(AnalyticsEventType.AUDIO_PLAY, { artifactId: artifact.id, name: artifact.name });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 bg-white rounded-lg shadow-xl border border-gray-200">
      {shareConfirmation && (
        <div className="fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
          {shareConfirmation}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/2">
          <img
            src={artifact.imageUrl}
            alt={artifact.name}
            className="w-full h-auto object-cover rounded-lg shadow-md mb-6 border border-gray-200"
          />
          <h2 className="text-4xl font-extrabold text-gray-900 mb-2">{artifact.name}</h2>
          <p className="text-xl text-gray-700 mb-4">{artifact.artist} ({artifact.year})</p>

          <div className="space-y-2 text-gray-600 mb-6">
            <p><strong>{t('category_label')}</strong> {artifact.category}</p>
            <p><strong>{t('materials_label')}</strong> {artifact.materials.join(', ')}</p>
            <p><strong>{t('dimensions_label')}</strong> {artifact.dimensions}</p>
            <p className="flex items-center">
              <strong>{t('located_at_label')}</strong> {artifact.museum}, {artifact.location.city}, {artifact.location.country}
              <NavLink to="/map" className="text-blue-600 hover:underline inline-flex items-center ml-4">
                {t('view_on_map_link')}
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </NavLink>
              {/* Share Button */}
              <button
                onClick={handleShare}
                className="ml-2 p-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                title={t('share_button')}
                aria-label={t('share_button')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.479-.114-.933-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.514 3.257c.502.251 1.055-.176 1.055-.795V10.74a3 3 0 01.884-.376l.995-.497c.548-.274 1.255.197 1.255.828v1.942c0 .631-.707 1.102-1.255.828l-.995-.497a3 3 0 01-.884-.376v-1.12c-.22.44-.925 1.053-1.637 1.408l-6.514 3.257z" />
                </svg>
              </button>
            </p>
          </div>
          <p className="text-gray-800 leading-relaxed mb-6 flex items-center bg-gray-50 p-4 rounded-lg shadow-inner border border-gray-100">
            {artifact.initialDescription}
            {artifact.initialDescription && (
              <button
                onClick={handlePlayDescription}
                disabled={isSpeakingDescription || !artifact.initialDescription || !!speechError}
                className="ml-3 p-2 flex-shrink-0 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={t('listen_to_description')}
                aria-label={t('listen_to_description')}
              >
                {isSpeakingDescription ? (
                  <LoadingSpinner small message="" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.616 5.178a1 1 0 00-1.223 1.583c.896.696 1.405 1.706 1.405 2.739 0 1.033-.509 2.043-1.405 2.739a1 1 0 001.223 1.583c1.964-1.523 3.226-3.87 3.226-5.962 0-2.092-1.262-4.439-3.226-5.962z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )}
          </p>
        </div>

        <div className="lg:w-1/2">
          {/* AI Insight Section */}
          <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-8 border border-blue-100">
            <h3 className="text-2xl font-bold text-blue-800 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M18.172 7.828a4 4 0 00-5.656-5.656L10 4.343 7.485 1.828a4 4 0 00-5.656 5.656L4.343 10l-2.515 2.515a4 4 0 005.656 5.656L10 15.657l2.515 2.515a4 4 0 005.656-5.656L15.657 10l2.515-2.515zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"></path>
              </svg>
              {t('ai_insight_title')}
            </h3>
            {loadingAiInsight ? (
              <LoadingSpinner message={t('generating_ai_insight')} />
            ) : insightError ? (
              <ErrorMessage message={insightError} />
            ) : aiInsight ? (
              <div className="prose prose-blue max-w-none text-gray-700 leading-relaxed">
                <div className="flex items-start">
                  <div className="flex-grow">
                    <Markdown remarkPlugins={[remarkGfm]}>{aiInsight}</Markdown>
                  </div>
                  {aiInsight && (
                    <button
                      onClick={handlePlayAiInsight}
                      disabled={isSpeakingInsight || !aiInsight || !!speechError}
                      className="ml-3 p-2 flex-shrink-0 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title={t('listen_to_ai_insight')}
                      aria-label={t('listen_to_ai_insight')}
                    >
                      {isSpeakingInsight ? (
                        <LoadingSpinner small message="" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.616 5.178a1 1 0 00-1.223 1.583c.896.696 1.405 1.706 1.405 2.739 0 1.033-.509 2.043-1.405 2.739a1 1 0 001.223 1.583c1.964-1.523 3.226-3.87 3.226-5.962 0-2.092-1.262-4.439-3.226-5.962z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-600">{t('no_ai_insight_available')}</p>
            )}
            {speechError && <ErrorMessage message={speechError} />}
          </div>

          {/* Multimedia Section */}
          {(artifact.videoUrl || artifact.audioUrl) && (
            <div className="bg-gray-50 p-6 rounded-lg shadow-md mb-8 border border-gray-100">
              <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm3 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"></path>
                </svg>
                {t('explore_more_title')}
              </h3>
              {artifact.videoUrl && (
                <div className="mb-6">
                  <h4 className="text-xl font-semibold text-gray-700 mb-3">{t('video_tour_title')}</h4>
                  <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden shadow-md border border-gray-200">
                    <iframe
                      src={artifact.videoUrl}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={t('video_title', { name: artifact.name })}
                      className="w-full h-full"
                      onPlay={handleVideoPlay}
                    ></iframe>
                  </div>
                </div>
              )}
              {artifact.audioUrl && (
                <div>
                  <h4 className="text-xl font-semibold text-gray-700 mb-3">{t('audio_guide_title')}</h4>
                  <audio controls className="w-full" onPlay={handleAudioPlay}>
                    <source src={artifact.audioUrl} type="audio/ogg" />
                    {t('audio_not_supported')}
                  </audio>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Recommendations Section */}
      <div className="mt-12 bg-white p-6 rounded-lg shadow-xl border border-gray-200">
        <h3 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-blue-600 pb-2 inline-block">{t('ai_recommendations_title')}</h3>
        {loadingRecommendations ? (
          <LoadingSpinner message={t('finding_similar_artworks')} />
        ) : recommendationError ? (
          <ErrorMessage message={recommendationError} />
        ) : recommendations && recommendations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map(rec => (
              <ArtifactCard key={rec.id} artifact={rec} />
            ))}
          </div>
        ) : (
          <p className="text-gray-600">{t('no_ai_recommendations_available')}</p>
        )}
      </div>

      {showFallbackShareModal && artifact && (
        <FallbackShareModal
          artifact={artifact}
          onClose={() => setShowFallbackShareModal(false)}
          onLinkCopied={handleLinkCopied}
          t={t}
        />
      )}
    </div>
  );
};

export default ArtifactDetailPage;