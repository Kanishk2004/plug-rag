'use client';
import { useState, useEffect } from 'react';
import {
	PlusIcon,
	LoadingSpinner,
	TrashIcon,
	CheckIcon,
} from '@/components/ui/icons';

export default function FAQTab({ botId, showNotification }) {
	const [faqs, setFaqs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [editingId, setEditingId] = useState(null);

	// Form state
	const [formData, setFormData] = useState({
		question: '',
		answer: '',
		keywords: '',
		enabled: true,
		autoGenKeywords: true,
	});

	// Edit form state
	const [editData, setEditData] = useState({
		question: '',
		answer: '',
		keywords: '',
		enabled: true,
		autoGenKeywords: false,
	});

	// Fetch FAQs
	const fetchFAQs = async () => {
		try {
			setLoading(true);
			const response = await fetch(`/api/bots/${botId}/faqs`);
			const data = await response.json();

			if (data.success) {
				setFaqs(data.data.faqs || []);
			} else {
				showNotification(data.message || 'Failed to fetch FAQs', 'error');
			}
		} catch (error) {
			console.error('Error fetching FAQs:', error);
			showNotification('Failed to fetch FAQs', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (botId) {
			fetchFAQs();
		}
	}, [botId]);

	// Create FAQ
	const handleCreate = async (e) => {
		e.preventDefault();

		if (!formData.question.trim() || !formData.answer.trim()) {
			showNotification('Question and answer are required', 'error');
			return;
		}

		if (formData.question.length < 3 || formData.question.length > 500) {
			showNotification(
				'Question must be between 3 and 500 characters',
				'error'
			);
			return;
		}

		if (formData.answer.length < 3 || formData.answer.length > 2000) {
			showNotification('Answer must be between 3 and 2000 characters', 'error');
			return;
		}

		try {
			setSubmitting(true);

			const keywordsArray = formData.keywords
				.split(',')
				.map((k) => k.trim())
				.filter((k) => k);

			const url = formData.autoGenKeywords
				? `/api/bots/${botId}/faqs?genKeywords=true`
				: `/api/bots/${botId}/faqs`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					question: formData.question.trim(),
					answer: formData.answer.trim(),
					keywords: keywordsArray.length > 0 ? keywordsArray : undefined,
					enabled: formData.enabled,
				}),
			});

			const data = await response.json();

			if (data.success) {
				showNotification('FAQ created successfully', 'success');
				setFormData({
					question: '',
					answer: '',
					keywords: '',
					enabled: true,
					autoGenKeywords: true,
				});
				fetchFAQs();
			} else {
				showNotification(data.message || 'Failed to create FAQ', 'error');
			}
		} catch (error) {
			console.error('Error creating FAQ:', error);
			showNotification('Failed to create FAQ', 'error');
		} finally {
			setSubmitting(false);
		}
	};

	// Update FAQ
	const handleUpdate = async (faqId) => {
		if (!editData.question.trim() || !editData.answer.trim()) {
			showNotification('Question and answer are required', 'error');
			return;
		}

		if (editData.question.length < 3 || editData.question.length > 500) {
			showNotification(
				'Question must be between 3 and 500 characters',
				'error'
			);
			return;
		}

		if (editData.answer.length < 3 || editData.answer.length > 2000) {
			showNotification('Answer must be between 3 and 2000 characters', 'error');
			return;
		}

		try {
			const keywordsArray = editData.keywords
				.split(',')
				.map((k) => k.trim())
				.filter((k) => k);

			const url = editData.autoGenKeywords
				? `/api/bots/${botId}/faqs/${faqId}?genKeywords=true`
				: `/api/bots/${botId}/faqs/${faqId}`;

			const response = await fetch(url, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					question: editData.question.trim(),
					answer: editData.answer.trim(),
					keywords: keywordsArray.length > 0 ? keywordsArray : undefined,
					enabled: editData.enabled,
				}),
			});

			const data = await response.json();

			if (data.success) {
				showNotification('FAQ updated successfully', 'success');
				setEditingId(null);
				fetchFAQs();
			} else {
				showNotification(data.message || 'Failed to update FAQ', 'error');
			}
		} catch (error) {
			console.error('Error updating FAQ:', error);
			showNotification('Failed to update FAQ', 'error');
		}
	};

	// Delete FAQ
	const handleDelete = async (faqId, question) => {
		const confirmed = confirm(
			`Are you sure you want to delete this FAQ?\n\n"${question}"\n\nThis action cannot be undone.`
		);

		if (!confirmed) return;

		try {
			const response = await fetch(`/api/bots/${botId}/faqs/${faqId}`, {
				method: 'DELETE',
			});

			const data = await response.json();

			if (data.success) {
				showNotification('FAQ deleted successfully', 'success');
				fetchFAQs();
			} else {
				showNotification(data.message || 'Failed to delete FAQ', 'error');
			}
		} catch (error) {
			console.error('Error deleting FAQ:', error);
			showNotification('Failed to delete FAQ', 'error');
		}
	};

	// Toggle enabled
	const handleToggleEnabled = async (faq) => {
		try {
			const response = await fetch(`/api/bots/${botId}/faqs/${faq._id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					enabled: !faq.enabled,
				}),
			});

			const data = await response.json();

			if (data.success) {
				showNotification(
					`FAQ ${!faq.enabled ? 'enabled' : 'disabled'} successfully`,
					'success'
				);
				fetchFAQs();
			} else {
				showNotification(data.message || 'Failed to update FAQ', 'error');
			}
		} catch (error) {
			console.error('Error toggling FAQ:', error);
			showNotification('Failed to update FAQ', 'error');
		}
	};

	// Start editing
	const startEdit = (faq) => {
		setEditingId(faq._id);
		setEditData({
			question: faq.question || '',
			answer: faq.answer || '',
			keywords: faq.keywords ? faq.keywords.join(', ') : '',
			enabled: faq.enabled !== false,
			autoGenKeywords: false,
		});
	};

	// Cancel editing
	const cancelEdit = () => {
		setEditingId(null);
		setEditData({
			question: '',
			answer: '',
			keywords: '',
			enabled: true,
			autoGenKeywords: false,
		});
	};

	if (loading) {
		return (
			<div className="lg:col-span-12">
				<div className="bg-gray-900 border border-gray-800 rounded-lg p-8 flex items-center justify-center">
					<LoadingSpinner className="w-8 h-8" />
				</div>
			</div>
		);
	}

	return (
		<div className="lg:col-span-12 space-y-6">
			{/* Create FAQ Form */}
			<div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
				<h2 className="text-lg font-semibold text-white mb-4">
					Create New FAQ
				</h2>
				<form onSubmit={handleCreate} className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-gray-200 mb-2">
							Question <span className="text-red-400">*</span>
						</label>
						<input
							type="text"
							value={formData.question}
							onChange={(e) =>
								setFormData({ ...formData, question: e.target.value })
							}
							placeholder="What is your question?"
							className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
							maxLength={500}
						/>
						<p className="text-xs text-gray-400 mt-1">
							{formData.question.length}/500 characters
						</p>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-200 mb-2">
							Answer <span className="text-red-400">*</span>
						</label>
						<textarea
							value={formData.answer}
							onChange={(e) =>
								setFormData({ ...formData, answer: e.target.value })
							}
							placeholder="Provide a detailed answer..."
							rows={4}
							className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
							maxLength={2000}
						/>
						<p className="text-xs text-gray-400 mt-1">
							{formData.answer.length}/2000 characters
						</p>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-200 mb-2">
							Keywords (comma-separated)
						</label>
						<input
							type="text"
							value={formData.keywords}
							onChange={(e) =>
								setFormData({ ...formData, keywords: e.target.value })
							}
							placeholder="keyword1, keyword2, keyword3"
							className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
							disabled={formData.autoGenKeywords}
						/>
					</div>

					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-4">
							<label className="flex items-center space-x-2 cursor-pointer">
								<input
									type="checkbox"
									checked={formData.autoGenKeywords}
									onChange={(e) =>
										setFormData({
											...formData,
											autoGenKeywords: e.target.checked,
										})
									}
									className="w-4 h-4 text-orange-500 bg-gray-800 border-gray-700 rounded focus:ring-orange-500"
								/>
								<span className="text-sm text-gray-200">
									Auto-generate keywords
								</span>
							</label>

							<label className="flex items-center space-x-2 cursor-pointer">
								<input
									type="checkbox"
									checked={formData.enabled}
									onChange={(e) =>
										setFormData({ ...formData, enabled: e.target.checked })
									}
									className="w-4 h-4 text-orange-500 bg-gray-800 border-gray-700 rounded focus:ring-orange-500"
								/>
								<span className="text-sm text-gray-200">Enabled</span>
							</label>
						</div>

						<button
							type="submit"
							disabled={submitting}
							className="flex items-center space-x-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
							{submitting ? (
								<LoadingSpinner className="w-4 h-4" />
							) : (
								<PlusIcon className="w-4 h-4" />
							)}
							<span>{submitting ? 'Creating...' : 'Create FAQ'}</span>
						</button>
					</div>
				</form>
			</div>

			{/* FAQs List */}
			<div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold text-white">
						FAQs ({faqs.length})
					</h2>
				</div>

				{faqs.length === 0 ? (
					<div className="text-center py-12">
						<p className="text-gray-400 mb-4">No FAQs yet</p>
						<p className="text-sm text-gray-500">
							Create your first FAQ using the form above
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{faqs.map((faq) => (
							<div
								key={faq._id}
								className="bg-gray-800 border border-gray-700 rounded-lg p-4">
								{editingId === faq._id ? (
									// Edit Mode
									<div className="space-y-4">
										<div>
											<label className="block text-sm font-medium text-gray-200 mb-2">
												Question
											</label>
											<input
												type="text"
												value={editData.question}
												onChange={(e) =>
													setEditData({ ...editData, question: e.target.value })
												}
												className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
												maxLength={500}
											/>
											<p className="text-xs text-gray-400 mt-1">
												{editData.question.length}/500 characters
											</p>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-200 mb-2">
												Answer
											</label>
											<textarea
												value={editData.answer}
												onChange={(e) =>
													setEditData({ ...editData, answer: e.target.value })
												}
												rows={4}
												className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
												maxLength={2000}
											/>
											<p className="text-xs text-gray-400 mt-1">
												{editData.answer.length}/2000 characters
											</p>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-200 mb-2">
												Keywords (comma-separated)
											</label>
											<input
												type="text"
												value={editData.keywords}
												onChange={(e) =>
													setEditData({ ...editData, keywords: e.target.value })
												}
												className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
												disabled={editData.autoGenKeywords}
											/>
										</div>

										<div className="flex items-center space-x-4">
											<label className="flex items-center space-x-2 cursor-pointer">
												<input
													type="checkbox"
													checked={editData.autoGenKeywords}
													onChange={(e) =>
														setEditData({
															...editData,
															autoGenKeywords: e.target.checked,
														})
													}
													className="w-4 h-4 text-orange-500 bg-gray-800 border-gray-700 rounded focus:ring-orange-500"
												/>
												<span className="text-sm text-gray-200">
													Auto-generate keywords
												</span>
											</label>

											<label className="flex items-center space-x-2 cursor-pointer">
												<input
													type="checkbox"
													checked={editData.enabled}
													onChange={(e) =>
														setEditData({
															...editData,
															enabled: e.target.checked,
														})
													}
													className="w-4 h-4 text-orange-500 bg-gray-800 border-gray-700 rounded focus:ring-orange-500"
												/>
												<span className="text-sm text-gray-200">Enabled</span>
											</label>
										</div>

										<div className="flex items-center space-x-2">
											<button
												onClick={() => handleUpdate(faq._id)}
												className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors">
												Save Changes
											</button>
											<button
												onClick={cancelEdit}
												className="px-4 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 font-medium transition-colors">
												Cancel
											</button>
										</div>
									</div>
								) : (
									// View Mode
									<div>
										<div className="flex items-start justify-between mb-3">
											<div className="flex-1">
												<h3 className="text-white font-medium mb-2">
													{faq.question}
												</h3>
												<p className="text-gray-300 text-sm whitespace-pre-wrap">
													{faq.answer}
												</p>
											</div>
											<span
												className={`ml-4 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
													faq.enabled !== false
														? 'bg-green-400/20 text-green-400 border border-green-400/30'
														: 'bg-gray-600 text-gray-300'
												}`}>
												{faq.enabled !== false ? 'Enabled' : 'Disabled'}
											</span>
										</div>

										{faq.keywords && faq.keywords.length > 0 && (
											<div className="mb-3">
												<p className="text-xs text-gray-400 mb-1">Keywords:</p>
												<div className="flex flex-wrap gap-2">
													{faq.keywords.map((keyword, index) => (
														<span
															key={index}
															className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
															{keyword}
														</span>
													))}
												</div>
											</div>
										)}

										<div className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-700">
											<button
												onClick={() => startEdit(faq)}
												className="px-3 py-1 text-sm border border-gray-700 text-gray-200 rounded hover:bg-gray-700 transition-colors">
												Edit
											</button>
											<button
												onClick={() => handleToggleEnabled(faq)}
												className="px-3 py-1 text-sm border border-gray-700 text-gray-200 rounded hover:bg-gray-700 transition-colors">
												{faq.enabled !== false ? 'Disable' : 'Enable'}
											</button>
											<button
												onClick={() => handleDelete(faq._id, faq.question)}
												className="px-3 py-1 text-sm border border-red-700 text-red-400 rounded hover:bg-red-900/20 transition-colors">
												Delete
											</button>
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
