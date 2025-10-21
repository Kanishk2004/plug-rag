'use client';
import { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FileUpload from '@/components/FileUpload';

export default function BotDetail({ params }) {
  const botId = params?.id || '1';
  
  // Mock bot data - in real app, fetch from API
  const [bot, setBot] = useState({
    id: botId,
    name: 'Customer Support Bot',
    description: 'Handles customer inquiries and support tickets',
    status: 'active',
    conversations: 456,
    files: [
      { id: 1, name: 'FAQ.pdf', size: '2.3 MB', uploadedAt: '2024-10-15' },
      { id: 2, name: 'Product Guide.docx', size: '1.8 MB', uploadedAt: '2024-10-14' },
      { id: 3, name: 'Support Scripts.txt', size: '0.5 MB', uploadedAt: '2024-10-13' }
    ],
    embedColor: '#f97316',
    embedPosition: 'bottom-right',
    createdAt: '2024-10-15',
    lastActive: '2 hours ago'
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: bot.name,
    description: bot.description
  });

  const handleEdit = () => {
    setIsEditing(true);
    setEditForm({
      name: bot.name,
      description: bot.description
    });
  };

  const handleSave = () => {
    setBot(prev => ({
      ...prev,
      name: editForm.name,
      description: editForm.description
    }));
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({
      name: bot.name,
      description: bot.description
    });
  };

  const toggleStatus = () => {
    setBot(prev => ({
      ...prev,
      status: prev.status === 'active' ? 'inactive' : 'active'
    }));
  };

  const handleFilesUploaded = (files) => {
    // Handle new files upload
    console.log('New files uploaded:', files);
  };

  const removeFile = (fileId) => {
    setBot(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId)
    }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Link 
                href="/dashboard/bots"
                className="text-gray-300 hover:text-gray-200"
              >
                ← Back to Bots
              </Link>
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="text-2xl font-bold text-white bg-transparent border-b-2 border-orange-500 focus:outline-none"
                />
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="text-gray-200 bg-transparent border border-gray-700 rounded px-2 py-1 w-full focus:outline-none focus:border-orange-500"
                  rows="2"
                />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white">{bot.name}</h1>
                <p className="mt-2 text-gray-200">{bot.description}</p>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              bot.status === 'active' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-800 text-gray-200'
            }`}>
              {bot.status}
            </span>
            
            {isEditing ? (
              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleEdit}
                className="px-4 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 font-medium transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h2 className="text-lg font-medium text-white mb-4">Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{bot.conversations}</p>
                  <p className="text-sm text-gray-200">Conversations</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{bot.files.length}</p>
                  <p className="text-sm text-gray-200">Files</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">98%</p>
                  <p className="text-sm text-gray-200">Uptime</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">4.8</p>
                  <p className="text-sm text-gray-200">Rating</p>
                </div>
              </div>
            </div>

            {/* Files Management */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Content Files</h2>
              
              {/* Current Files */}
              <div className="space-y-3 mb-6">
                {bot.files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                        <FileIcon className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-600">{file.size} • Uploaded {file.uploadedAt}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <XIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Upload New Files */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Add More Files</h3>
                <FileUpload onFilesUploaded={handleFilesUploaded} maxFiles={5} />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  href={`/dashboard/bots/${bot.id}/embed`}
                  className="block w-full bg-orange-100 hover:bg-orange-200 text-orange-700 py-3 px-4 rounded-lg text-center font-medium transition-colors"
                >
                  Get Embed Code
                </Link>
                <button
                  onClick={toggleStatus}
                  className={`w-full py-3 px-4 rounded-lg text-center font-medium transition-colors ${
                    bot.status === 'active'
                      ? 'bg-red-100 hover:bg-red-200 text-red-700'
                      : 'bg-green-100 hover:bg-green-200 text-green-700'
                  }`}
                >
                  {bot.status === 'active' ? 'Disable Bot' : 'Enable Bot'}
                </button>
                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-center font-medium transition-colors">
                  Download Chat History
                </button>
              </div>
            </div>

            {/* Bot Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Bot Information</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600">Created:</span>
                  <span className="ml-2 text-gray-900">{bot.createdAt}</span>
                </div>
                <div>
                  <span className="text-gray-600">Last Active:</span>
                  <span className="ml-2 text-gray-900">{bot.lastActive}</span>
                </div>
                <div>
                  <span className="text-gray-600">Bot ID:</span>
                  <span className="ml-2 font-mono text-gray-900">{bot.id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Theme Color:</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <div 
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: bot.embedColor }}
                    />
                    <span className="font-mono text-gray-900">{bot.embedColor}</span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Position:</span>
                  <span className="ml-2 text-gray-900 capitalize">{bot.embedPosition.replace('-', ' ')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Icons
const FileIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const XIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);