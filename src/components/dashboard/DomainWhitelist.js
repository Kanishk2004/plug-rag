'use client';
import { useState } from 'react';

export default function DomainWhitelist({
	botId,
	domains,
	onDomainsChange,
	showNotification,
}) {
	const [newDomain, setNewDomain] = useState('');
	const [saving, setSaving] = useState(false);

	const addDomain = async () => {
		if (!newDomain.trim()) return;

		// Basic domain validation
		const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		if (!domainRegex.test(newDomain.trim())) {
			showNotification(
				'Please enter a valid domain (e.g., example.com)',
				'error'
			);
			return;
		}

		const domain = newDomain.trim().toLowerCase();
		if (domains.includes(domain)) {
			showNotification('Domain already exists in whitelist', 'error');
			return;
		}

		setSaving(true);
		try {
			const response = await fetch(`/api/bots/${botId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					domainWhitelist: [...domains, domain],
				}),
			});

			const data = await response.json();
			if (data.success) {
				onDomainsChange([...domains, domain]);
				setNewDomain('');
				showNotification('Domain added successfully');
			} else {
				showNotification(data.message || 'Failed to add domain', 'error');
			}
		} catch (err) {
			console.error('Error adding domain:', err);
			showNotification('Failed to add domain', 'error');
		} finally {
			setSaving(false);
		}
	};

	const removeDomain = async (domainToRemove) => {
		setSaving(true);
		try {
			const newDomains = domains.filter((d) => d !== domainToRemove);
			const response = await fetch(`/api/bots/${botId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					domainWhitelist: newDomains,
				}),
			});

			const data = await response.json();
			if (data.success) {
				onDomainsChange(newDomains);
				showNotification('Domain removed successfully');
			} else {
				showNotification(data.message || 'Failed to remove domain', 'error');
			}
		} catch (err) {
			console.error('Error removing domain:', err);
			showNotification('Failed to remove domain', 'error');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
			<h2 className="text-xl font-semibold text-white mb-2">
				🔒 Domain Security
			</h2>
			<p className="text-gray-400 mb-6">
				Control which domains can embed your chatbot. Leave empty to allow all
				domains.
			</p>

			<div className="space-y-4">
				<div className="flex space-x-3">
					<input
						type="text"
						value={newDomain}
						onChange={(e) => setNewDomain(e.target.value)}
						onKeyPress={(e) => e.key === 'Enter' && addDomain()}
						placeholder="example.com"
						className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-gray-400"
					/>
					<button
						onClick={addDomain}
						disabled={saving}
						className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">
						{saving ? 'Adding...' : 'Add'}
					</button>
				</div>

				{domains.length > 0 && (
					<div className="space-y-3">
						<p className="text-sm font-medium text-gray-300">
							Allowed Domains:
						</p>
						<div className="max-h-48 overflow-y-auto space-y-2">
							{domains.map((domain) => (
								<div
									key={domain}
									className="flex items-center justify-between bg-gray-700 px-4 py-2 rounded-lg border border-gray-600">
									<span className="text-white font-mono text-sm">{domain}</span>
									<button
										onClick={() => removeDomain(domain)}
										disabled={saving}
										className="text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors p-1">
										<TrashIcon className="w-5 h-5" />
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				{domains.length === 0 && (
					<div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
						<p className="text-yellow-200 text-sm">
							<strong>⚠️ Warning:</strong> No domain restrictions set. The
							chatbot can be embedded on any website.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

const TrashIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
		/>
	</svg>
);
