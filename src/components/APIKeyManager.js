'use client';
import { useState, useEffect } from 'react';

// Simple SVG icon components to avoid dependency issues
const EyeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeSlashIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
  </svg>
);

const KeyIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const CheckCircleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

/**
 * API Key Manager Component
 * Provides interface for managing custom OpenAI API keys per bot
 */
export default function APIKeyManager({ botId, onKeyUpdate }) {
  // State management
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load existing configuration on mount
  useEffect(() => {
    if (botId) {
      loadConfiguration();
    }
  }, [botId]);

  /**
   * Load current API key configuration for the bot
   */
  const loadConfiguration = async () => {
    try {
      const response = await fetch(`/api/bots/${botId}/api-keys`);
      const data = await response.json();
      
      if (data.success) {
        setConfiguration(data.data);
      } else {
        setError(data.error || 'Failed to load configuration');
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      setError('Failed to load API key configuration');
    }
  };

  /**
   * Validate API key without storing it
   */
  const validateKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsValidating(true);
    setError('');
    setValidationResult(null);
    
    try {
      const response = await fetch(`/api/bots/${botId}/api-keys/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setValidationResult({
          isValid: true,
          ...data.data
        });
        setSuccessMessage('API key is valid and ready to use!');
      } else {
        setValidationResult({
          isValid: false,
          error: data.data?.error || data.message
        });
        setError(data.data?.error || 'API key validation failed');
      }
    } catch (error) {
      setError('Failed to validate API key. Please try again.');
      setValidationResult({ isValid: false, error: error.message });
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Save the validated API key
   */
  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    // Require validation before saving
    if (!validationResult?.isValid) {
      setError('Please validate the API key before saving');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(`/api/bots/${botId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey: apiKey.trim(),
          fallbackToGlobal: false, // Don't fallback when we're explicitly setting a custom key
          costTracking: {
            enabled: true
          }
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage('API key saved successfully!');
        setApiKey(''); // Clear input for security
        setValidationResult(null);
        await loadConfiguration(); // Reload configuration
        
        // Notify parent component about the update
        if (onKeyUpdate) {
          onKeyUpdate();
        }
      } else {
        setError(data.error || 'Failed to save API key');
      }
    } catch (error) {
      setError('Failed to save API key. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove the stored API key
   */
  const removeApiKey = async () => {
    if (!confirm('Are you sure you want to remove the custom API key? This bot will fall back to the global key.')) {
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/bots/${botId}/api-keys`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage('API key removed successfully');
        setConfiguration(null);
        setApiKey('');
        setValidationResult(null);
        await loadConfiguration();
        
        // Notify parent component about the update
        if (onKeyUpdate) {
          onKeyUpdate();
        }
      } else {
        setError(data.error || 'Failed to remove API key');
      }
    } catch (error) {
      setError('Failed to remove API key');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get status color based on key status
   */
  const getStatusColor = (status) => {
    switch (status) {
      case 'valid': return 'text-green-400 bg-green-900/20 border-green-700';
      case 'invalid': return 'text-red-400 bg-red-900/20 border-red-700';
      case 'expired': return 'text-orange-400 bg-orange-900/20 border-orange-700';
      case 'quota_exceeded': return 'text-purple-400 bg-purple-900/20 border-purple-700';
      default: return 'text-gray-400 bg-gray-800 border-gray-600';
    }
  };

  /**
   * Get status display text
   */
  const getStatusText = (status) => {
    switch (status) {
      case 'valid': return 'Valid API key configured';
      case 'invalid': return 'Invalid API key';
      case 'expired': return 'API key expired';
      case 'quota_exceeded': return 'Quota exceeded';
      case 'none': return 'No custom API key configured';
      default: return 'Unknown status';
    }
  };

  /**
   * Format large numbers for display
   */
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <KeyIcon className="w-5 h-5" />
          OpenAI API Configuration
        </h3>
        <p className="text-sm text-gray-200 mt-1">
          Configure a custom OpenAI API key for this bot to use your own OpenAI account and billing.
        </p>
      </div>

      {/* Current Status */}
      {configuration && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(configuration.keyStatus)}`}>
                <div className="flex items-center gap-1.5">
                  {configuration.keyStatus === 'valid' ? (
                    <CheckCircleIcon className="w-3 h-3" />
                  ) : (
                    <XCircleIcon className="w-3 h-3" />
                  )}
                  {getStatusText(configuration.keyStatus)}
                </div>
              </div>
              {configuration.lastValidated && (
                <span className="text-xs text-gray-400">
                  Last validated: {new Date(configuration.lastValidated).toLocaleString()}
                </span>
              )}
            </div>
            {configuration.hasCustomKey && (
              <button
                onClick={removeApiKey}
                disabled={isLoading}
                className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
              >
                Remove Key
              </button>
            )}
          </div>
          
          {/* Usage Information */}
          {configuration.usage && configuration.hasCustomKey && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-200 mb-3">Usage Statistics</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">{formatNumber(configuration.usage.totalTokens)}</div>
                  <div className="text-gray-300">Total Tokens</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">{formatNumber(configuration.usage.chatTokens)}</div>
                  <div className="text-gray-300">Chat Tokens</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">{formatNumber(configuration.usage.embedTokens)}</div>
                  <div className="text-gray-300">Embed Tokens</div>
                </div>
              </div>
            </div>
          )}

          {/* Model Configuration */}
          {configuration.models && configuration.hasCustomKey && (
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-200 mb-3">Model Configuration</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-300">Chat Model:</span>
                  <span className="ml-2 font-medium text-white">{configuration.models.chat}</span>
                </div>
                <div>
                  <span className="text-gray-300">Embeddings Model:</span>
                  <span className="ml-2 font-medium text-white">{configuration.models.embeddings}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* API Key Input Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-medium text-white">
          {configuration?.hasCustomKey ? 'Update API Key' : 'Add Custom API Key'}
        </h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            OpenAI API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setValidationResult(null);
                setError('');
                setSuccessMessage('');
              }}
              placeholder="sk-proj-..."
              className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              disabled={isLoading || isValidating}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              disabled={isLoading || isValidating}
            >
              {showKey ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Validation Result */}
        {validationResult && (
          <div className={`p-3 rounded-md border text-sm ${
            validationResult.isValid 
              ? 'bg-green-900/20 border-green-700 text-green-300' 
              : 'bg-red-900/20 border-red-700 text-red-300'
          }`}>
            {validationResult.isValid ? (
              <div>
                <div className="flex items-center gap-2 font-medium mb-2">
                  <CheckCircleIcon className="w-4 h-4" />
                  API Key Validated Successfully
                </div>
                {validationResult.supportedModels && (
                  <div>
                    <div className="text-xs">Supported models: {validationResult.supportedModels.chat?.length || 0} chat, {validationResult.supportedModels.embeddings?.length || 0} embedding</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircleIcon className="w-4 h-4" />
                Validation Failed: {validationResult.error}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={validateKey}
            disabled={!apiKey.trim() || isLoading || isValidating}
            className="px-4 py-2 text-sm border border-gray-600 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isValidating ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                Validating...
              </>
            ) : (
              'Validate Key'
            )}
          </button>
          
          <button
            onClick={saveApiKey}
            disabled={!apiKey.trim() || isLoading || isValidating || !validationResult?.isValid}
            className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              'Save API Key'
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-md p-3">
          <div className="text-sm text-red-300">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/20 border border-green-700 rounded-md p-3">
          <div className="text-sm text-green-300">{successMessage}</div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-1">
          🔒 Security & Privacy
        </h4>
        <ul className="text-xs text-blue-200 space-y-1">
          <li>• API keys are encrypted using AES-256-GCM and stored securely</li>
          <li>• Keys are never logged, displayed, or transmitted in plain text</li>
          <li>• Each bot uses its own API key for complete cost isolation</li>
          <li>• Global fallback ensures your bot continues working even if custom key fails</li>
          <li>• You maintain full control over your OpenAI usage and billing</li>
        </ul>
      </div>
    </div>
  );
}
