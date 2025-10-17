'use client';
import { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function MyBots() {
  const [bots] = useState([
    {
      id: 1,
      name: 'Customer Support Bot',
      description: 'Handles customer inquiries and support tickets',
      status: 'active',
      conversations: 456,
      files: 8,
      lastActive: '2 hours ago',
      createdAt: '2024-10-15',
      embedColor: '#f97316',
      embedPosition: 'bottom-right'
    },
    {
      id: 2,
      name: 'FAQ Assistant',
      description: 'Answers frequently asked questions about our product',
      status: 'active',
      conversations: 123,
      files: 5,
      lastActive: '5 hours ago',
      createdAt: '2024-10-12',
      embedColor: '#3b82f6',
      embedPosition: 'bottom-left'
    },
    {
      id: 3,
      name: 'Product Guide Bot',
      description: 'Provides detailed product information and guides',
      status: 'inactive',
      conversations: 89,
      files: 12,
      lastActive: '2 days ago',
      createdAt: '2024-10-08',
      embedColor: '#10b981',
      embedPosition: 'bottom-right'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredBots = bots.filter(bot => {
    const matchesSearch = bot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bot.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleBotStatus = (botId) => {
    // This would normally update the bot status in your database
    console.log(`Toggling status for bot ${botId}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Bots</h1>
            <p className="mt-2 text-gray-800">Manage your chatbots and their settings</p>
          </div>
          <Link
            href="/dashboard/create-bot"
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Create New Bot</span>
          </Link>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <SearchIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search bots..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Bots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onToggleStatus={() => toggleBotStatus(bot.id)}
            />
          ))}
        </div>

        {filteredBots.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BotsIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bots found</h3>
            <p className="text-gray-700 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Get started by creating your first chatbot'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Link
                href="/dashboard/create-bot"
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Create Your First Bot</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const BotCard = ({ bot, onToggleStatus }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 mb-1">{bot.name}</h3>
          <p className="text-sm text-gray-700 line-clamp-2">{bot.description}</p>
        </div>
        <div className="ml-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            bot.status === 'active' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {bot.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{bot.conversations}</p>
          <p className="text-xs text-gray-600">Conversations</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{bot.files}</p>
          <p className="text-xs text-gray-600">Files</p>
        </div>
      </div>

      {/* Last Active */}
      <div className="mb-6">
        <p className="text-sm text-gray-700">Last active: {bot.lastActive}</p>
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        <Link
          href={`/dashboard/bots/${bot.id}`}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors"
        >
          Manage
        </Link>
        <Link
          href={`/dashboard/bots/${bot.id}/embed`}
          className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors"
        >
          Embed
        </Link>
        <button
          onClick={onToggleStatus}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            bot.status === 'active'
              ? 'bg-red-100 hover:bg-red-200 text-red-700'
              : 'bg-green-100 hover:bg-green-200 text-green-700'
          }`}
        >
          {bot.status === 'active' ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  );
};

// Icons
const PlusIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const SearchIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);

const BotsIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-10.5 3.75H7.5m9-6.75h.008v.008H16.5V7.5ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
  </svg>
);