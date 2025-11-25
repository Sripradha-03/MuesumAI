// pages/AdminPage.tsx
import React, { useState, useEffect } from 'react';
import { useArtifacts } from '../context/ArtifactsContext';
import { Artifact } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { fileToBase64 } from '../utils/helpers';
import { useTranslation } from 'react-i18next'; // Import useTranslation

const ADMIN_PASSWORD = 'admin123'; // Hardcoded password for demonstration

const AdminPage: React.FC = () => {
  const { artifacts, addArtifact, removeArtifact } = useArtifacts();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const { t } = useTranslation(); // Use translation hook

  // Form states for adding a new artifact
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [initialDescription, setInitialDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [lat, setLat] = useState<number>(0);
  const [lng, setLng] = useState<number>(0);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [materials, setMaterials] = useState(''); // Comma-separated string
  const [dimensions, setDimensions] = useState('');
  const [museum, setMuseum] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isAddingArtifact, setIsAddingArtifact] = useState(false);
  
  // Geolocation states
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError(null);
      setPasswordInput(''); // Clear password input after successful login
    } else {
      setLoginError(t('incorrect_password_error'));
    }
  };

  const resetForm = () => {
    setName('');
    setArtist('');
    setYear('');
    setInitialDescription('');
    setImageUrl('');
    setImageFile(null);
    setLat(0);
    setLng(0);
    setCity('');
    setCountry('');
    setCategory('');
    setMaterials('');
    setDimensions('');
    setMuseum('');
    setVideoUrl('');
    setAudioUrl('');
    setLocationError(null); // Clear location error on form reset
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    } else {
      setImageFile(null);
    }
  };

  const handleDetectLocation = () => {
    setIsDetectingLocation(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError(t('geolocation_not_supported_error'));
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);

        try {
          // Use OpenStreetMap Nominatim for reverse geocoding
          const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
          const response = await fetch(nominatimUrl);
          const data = await response.json();

          if (response.ok && data && data.address) {
            setCity(data.address.city || data.address.town || data.address.village || '');
            setCountry(data.address.country || '');
            console.log('Nominatim Attribution: Data © OpenStreetMap contributors, ODbL 1.0. https://osm.org/copyright');
          } else {
            console.warn('Nominatim reverse geocoding failed:', data);
            setLocationError(t('geolocation_reverse_geocode_failed'));
          }
        } catch (error) {
          console.error('Error during Nominatim reverse geocoding:', error);
          setLocationError(t('geolocation_reverse_geocode_failed_network'));
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        let errorMessage = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = t('geolocation_permission_denied_error');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = t('geolocation_position_unavailable_error');
            break;
          case error.TIMEOUT:
            errorMessage = t('geolocation_timeout_error');
            break;
          default:
            errorMessage = t('geolocation_unknown_error', { errorMessage: error.message });
            break;
        }
        setLocationError(errorMessage);
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleAddArtifact = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsAddingArtifact(true);

    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        const base64Content = await fileToBase64(imageFile);
        finalImageUrl = `data:${imageFile.type};base64,${base64Content}`; // Prepend data URI scheme with dynamic MIME type
      }

      if (!name || !artist || !year || !initialDescription || !finalImageUrl || !city || !country || !category || !materials || !dimensions || !museum) {
        throw new Error(t('fill_all_required_fields'));
      }

      const newArtifact: Omit<Artifact, 'id'> = {
        name,
        artist,
        year,
        initialDescription,
        imageUrl: finalImageUrl,
        location: { lat, lng, city, country },
        category,
        materials: materials.split(',').map(m => m.trim()).filter(m => m),
        dimensions,
        museum,
        videoUrl: videoUrl || undefined,
        audioUrl: audioUrl || undefined,
      };

      addArtifact(newArtifact);
      setMessage({ type: 'success', text: t('artifact_added_success', { name: name }) });
      resetForm();
    } catch (error: any) {
      console.error('Error adding artifact:', error);
      setMessage({ type: 'error', text: t('failed_to_add_artifact', { errorMessage: error.message || 'Unknown error' }) });
    } finally {
      setIsAddingArtifact(false);
    }
  };

  const handleRemoveArtifact = (id: string, name: string) => {
    if (window.confirm(t('confirm_remove_artifact', { name: name }))) {
      removeArtifact(id);
      setMessage({ type: 'success', text: t('artifact_removed_success', { name: name }) });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] flex-col p-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('admin_login_title')}</h1>
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-xl border border-gray-200 w-full max-w-sm">
          <div className="mb-4">
            <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-1">{t('admin_password_label')} <span className="text-red-500">*</span></label>
            <input
              type="password"
              id="adminPassword"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          {loginError && <ErrorMessage message={loginError} />}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-lg transition-colors duration-300"
          >
            {t('login_button')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 bg-white rounded-lg shadow-xl border border-gray-200">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">{t('admin_panel_button')}</h1>

      {message && (
        <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Add New Artifact Form */}
      <div className="mb-12 p-6 bg-blue-50 rounded-lg shadow-inner border border-blue-100">
        <h2 className="text-3xl font-bold text-blue-800 mb-6 border-b-2 border-blue-200 pb-2">{t('add_new_artifact_title')}</h2>
        <form onSubmit={handleAddArtifact} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">{t('name_label')} <span className="text-red-500">*</span></label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label htmlFor="artist" className="block text-sm font-medium text-gray-700 mb-1">{t('artist_label')} <span className="text-red-500">*</span></label>
            <input type="text" id="artist" value={artist} onChange={(e) => setArtist(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">{t('year_label')} <span className="text-red-500">*</span></label>
            <input type="text" id="year" value={year} onChange={(e) => setYear(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="initialDescription" className="block text-sm font-medium text-gray-700 mb-1">{t('initial_description_label')} <span className="text-red-500">*</span></label>
            <textarea id="initialDescription" value={initialDescription} onChange={(e) => setInitialDescription(e.target.value)}
              rows={4} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required></textarea>
          </div>

          <div>
            <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700 mb-1">{t('upload_image_file_label')}</label>
            <input type="file" id="imageFile" accept="image/*" onChange={handleImageFileChange}
              className="mt-1 block w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            <p className="text-xs text-gray-500 mt-1">{t('or_enter_image_url')}</p>
          </div>
          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">{t('image_url_label')}</label>
            <input type="text" id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>

          {/* Location Fields */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 p-4 bg-blue-100 rounded-md border border-blue-200">
            <h3 className="col-span-full text-lg font-semibold text-blue-800 mb-2">{t('location_label')}</h3>
            <div className="col-span-full mb-2">
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md shadow-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isDetectingLocation ? <LoadingSpinner small message={t('detecting_location_message')} /> : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    {t('detect_location_button')}
                  </>
                )}
              </button>
              {locationError && <ErrorMessage message={locationError} />}
              {(lat !== 0 || lng !== 0) && !locationError && (
                <p className="text-sm text-gray-600 mt-2 text-center">
                  {t('detected_coordinates')}: Lat: {lat.toFixed(4)}, Lng: {lng.toFixed(4)}
                </p>
              )}
            </div>
            
            <div className="md:col-span-2">
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">{t('city_label')} <span className="text-red-500">*</span></label>
              <input type="text" id="city" value={city} onChange={(e) => setCity(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">{t('country_label')} <span className="text-red-500">*</span></label>
              <input type="text" id="country" value={country} onChange={(e) => setCountry(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">{t('category_label')} <span className="text-red-500">*</span></label>
            <input type="text" id="category" value={category} onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label htmlFor="materials" className="block text-sm font-medium text-gray-700 mb-1">{t('materials_label_comma_separated')} <span className="text-red-500">*</span></label>
            <input type="text" id="materials" value={materials} onChange={(e) => setMaterials(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label htmlFor="dimensions" className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions_label_input')} <span className="text-red-500">*</span></label>
            <input type="text" id="dimensions" value={dimensions} onChange={(e) => setDimensions(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label htmlFor="museum" className="block text-sm font-medium text-gray-700 mb-1">{t('museum_label')} <span className="text-red-500">*</span></label>
            <input type="text" id="museum" value={museum} onChange={(e) => setMuseum(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 mb-1">{t('video_url_label')}</label>
            <input type="text" id="videoUrl" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label htmlFor="audioUrl" className="block text-sm font-medium text-gray-700 mb-1">{t('audio_url_label')}</label>
            <input type="text" id="audioUrl" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <div className="md:col-span-2">
            <button type="submit" disabled={isAddingArtifact}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md shadow-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
              {isAddingArtifact ? <LoadingSpinner small message={t('adding_message')} /> : t('add_artifact_button')}
            </button>
          </div>
        </form>
      </div>

      {/* Manage Existing Artifacts */}
      <div className="p-6 bg-gray-50 rounded-lg shadow-inner border border-gray-100">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b-2 border-gray-200 pb-2">{t('manage_existing_artifacts_title', { count: artifacts.length })}</h2>
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {artifacts.length === 0 ? (
            <p className="text-gray-600 italic">{t('no_artifacts_found')}</p>
          ) : (
            artifacts.map((artifact) => (
              <div key={artifact.id} className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <img src={artifact.imageUrl} alt={artifact.name} className="w-16 h-16 object-cover rounded-md mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{artifact.name}</h3>
                    <p className="text-sm text-gray-600">{artifact.artist} ({artifact.year})</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveArtifact(artifact.id, artifact.name)}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition-colors duration-300 text-sm"
                >
                  {t('remove_button')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;