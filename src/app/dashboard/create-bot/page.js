'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FileUpload from '@/components/FileUpload';

export default function CreateBot() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    embedColor: '#f97316',
    embedPosition: 'bottom-right'
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFilesUploaded = (files) => {
    setUploadedFiles(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Here you would normally send the data to your API
      console.log('Creating bot with:', {
        ...formData,
        files: uploadedFiles
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Redirect to bots page
      router.push('/dashboard/bots');
    } catch (error) {
      console.error('Error creating bot:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Create New Bot</h1>
          <p className="mt-2 text-gray-200">Set up a new chatbot with your custom content</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-lg font-medium text-white mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-200 mb-1">
                  Bot Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Customer Support Bot"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-200 mb-1">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Describe what this bot will help with..."
                />
              </div>
            </div>
          </div>

          {/* Embed Customization */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-lg font-medium text-white mb-4">Embed Customization</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="embedColor" className="block text-sm font-medium text-gray-200 mb-1">
                  Theme Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    id="embedColor"
                    name="embedColor"
                    value={formData.embedColor}
                    onChange={handleInputChange}
                    className="w-12 h-10 border border-gray-700 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.embedColor}
                    onChange={handleInputChange}
                    name="embedColor"
                    className="flex-1 px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="embedPosition" className="block text-sm font-medium text-gray-200 mb-1">
                  Position
                </label>
                <select
                  id="embedPosition"
                  name="embedPosition"
                  value={formData.embedPosition}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-200 mb-3">Preview</h3>
              <div className="relative bg-gray-800 rounded-lg p-4 h-32 overflow-hidden">
                <div className="text-xs text-gray-300 mb-2">Your website content here...</div>
                <div 
                  className={`absolute ${
                    formData.embedPosition === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4'
                  } w-12 h-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer`}
                  style={{ backgroundColor: formData.embedColor }}
                >
                  <ChatIcon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-lg font-medium text-white mb-4">Upload Content</h2>
            <p className="text-sm text-gray-200 mb-4">
              Upload files that your chatbot will use to answer questions. Supported formats: PDF, DOCX, TXT, CSV, HTML
            </p>
            <FileUpload onFilesUploaded={handleFilesUploaded} />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name || !formData.description}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              {isSubmitting && <LoadingIcon className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? 'Creating...' : 'Create Bot'}</span>
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

// Icons
const ChatIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.240.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.740.194V21l4.155-4.155" />
  </svg>
);

const LoadingIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
