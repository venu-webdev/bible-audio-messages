// Configuration - Replace with your actual Google Apps Script URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCrMMe5FUO2xYwIAFJvzYn9I8l3mgM5F1foA36gXdy6O1oEgU4r-z2e4jlTYOA15XZOg/exec';

// Global variables
let allMessages = [];
let currentAudio = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

async function initializeApp() {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('message-date').value = today;

    // Load messages
    await loadMessages();

    // Set up event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Book selection change handler
    document.getElementById('book-name').addEventListener('change', function () {
        const selectedBook = this.value;
        const chapterInput = document.getElementById('chapter-number');

        if (selectedBook) {
            const maxChapters = getMaxChapters(selectedBook);
            chapterInput.max = maxChapters;
            chapterInput.placeholder = `1-${maxChapters}`;
        }
    });
}

// Tab management
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Add active class to clicked button
    event.target.classList.add('active');
}

// Load messages from Google Sheets
async function loadMessages() {
    try {
        showLoading();
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getMessages`);
        const data = await response.json();

        if (data.success) {
            allMessages = data.messages;
            displayMessages(allMessages);
            updateFilterOptions();
        } else {
            showError('Failed to load messages: ' + data.error);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        showError('Error loading messages. Please check your connection.');
    }
}

// Display messages in the UI
function displayMessages(messages) {
    const container = document.getElementById('messages-container');

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bible"></i>
                <h3>No messages found</h3>
                <p>Upload your first audio message to get started.</p>
            </div>
        `;
        return;
    }

    const html = messages.map(message => `
        <div class="message-card">
            <div class="message-header">
                <h3 class="message-title">${message.book} ${message.chapter}:${message.verseRange}</h3>
                <span class="message-date">${formatDate(message.date)}</span>
            </div>
            
            <div class="message-details">
                <div class="detail-item">
                    <i class="fas fa-book"></i>
                    <span>${message.book}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-bookmark"></i>
                    <span>Chapter ${message.chapter}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-quote-left"></i>
                    <span>Verses ${message.verseRange}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDate(message.date)}</span>
                </div>
            </div>
            
            ${message.notes ? `<p class="message-notes"><strong>Notes:</strong> ${message.notes}</p>` : ''}
            
            <div class="message-actions">
                <button class="btn-play" onclick="playAudio('${message.fileId}', '${message.book} ${message.chapter}:${message.verseRange}', '${formatDate(message.date)}')">
                    <i class="fas fa-play"></i> Play
                </button>
                <a href="${message.downloadUrl}" class="btn-download" download>
                    <i class="fas fa-download"></i> Download
                </a>
                <button class="btn-edit" onclick="editMessage('${message.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-delete" onclick="deleteMessage('${message.id}', '${message.book} ${message.chapter}:${message.verseRange}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Filter messages based on current filters
function filterMessages() {
    const bookFilter = document.getElementById('book-filter').value;
    const chapterFilter = document.getElementById('chapter-filter').value;
    const searchInput = document.getElementById('search-input').value.toLowerCase();

    let filtered = allMessages.filter(message => {
        const matchesBook = !bookFilter || message.book === bookFilter;
        const matchesChapter = !chapterFilter || message.chapter.toString() === chapterFilter;
        const matchesSearch = !searchInput ||
            message.verseRange.toLowerCase().includes(searchInput) ||
            message.date.includes(searchInput) ||
            message.book.toLowerCase().includes(searchInput) ||
            (message.notes && message.notes.toLowerCase().includes(searchInput));

        return matchesBook && matchesChapter && matchesSearch;
    });

    displayMessages(filtered);
}

// Update filter options based on loaded messages
function updateFilterOptions() {
    const chapterFilter = document.getElementById('chapter-filter');
    const bookFilter = document.getElementById('book-filter');

    // Get unique chapters from current book selection
    const selectedBook = bookFilter.value;
    const chapters = new Set();

    allMessages.forEach(message => {
        if (!selectedBook || message.book === selectedBook) {
            chapters.add(message.chapter);
        }
    });

    // Update chapter dropdown
    chapterFilter.innerHTML = '<option value="">All Chapters</option>';
    Array.from(chapters).sort((a, b) => a - b).forEach(chapter => {
        const option = document.createElement('option');
        option.value = chapter;
        option.textContent = `Chapter ${chapter}`;
        chapterFilter.appendChild(option);
    });
}

// Clear all filters
function clearFilters() {
    document.getElementById('book-filter').value = '';
    document.getElementById('chapter-filter').value = '';
    document.getElementById('search-input').value = '';
    updateFilterOptions();
    displayMessages(allMessages);
}

// Upload new message
async function uploadMessage(event) {
    event.preventDefault();

    const form = document.getElementById('upload-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        submitBtn.disabled = true;

        // Get form data
        const formData = new FormData();
        formData.append('action', 'uploadMessage');
        formData.append('date', document.getElementById('message-date').value);
        formData.append('book', document.getElementById('book-name').value);
        formData.append('chapter', document.getElementById('chapter-number').value);
        formData.append('verseRange', document.getElementById('verse-range').value);
        formData.append('notes', document.getElementById('notes').value);
        formData.append('audioFile', document.getElementById('audio-file').files[0]);

        // Upload to Google Apps Script
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // Show success message
            showSuccess('Message uploaded successfully!');

            // Reset form
            form.reset();
            document.getElementById('message-date').value = new Date().toISOString().split('T')[0];

            // Reload messages
            await loadMessages();

            // Switch to browse tab
            showTab('browse');
        } else {
            showError('Upload failed: ' + data.error);
        }

    } catch (error) {
        console.error('Upload error:', error);
        showError('Upload failed. Please try again.');
    } finally {
        // Restore button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Audio player functions
async function playAudio(fileId, title, date) {
    try {
        // Get the audio URL from Google Drive
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAudioUrl&fileId=${fileId}`);
        const data = await response.json();

        if (data.success) {
            // Update player info
            document.getElementById('player-title').textContent = title;
            document.getElementById('player-details').textContent = `Date: ${date}`;

            // Set audio source
            const audioElement = document.getElementById('audio-element');
            audioElement.src = data.audioUrl;

            // Show player
            document.getElementById('audio-player').classList.remove('hidden');

            // Play audio
            audioElement.play();
            currentAudio = audioElement;
        } else {
            showError('Failed to load audio: ' + data.error);
        }
    } catch (error) {
        console.error('Error playing audio:', error);
        showError('Error playing audio. Please try again.');
    }
}

function closePlayer() {
    const player = document.getElementById('audio-player');
    const audioElement = document.getElementById('audio-element');

    // Pause and reset audio
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.src = '';

    // Hide player
    player.classList.add('hidden');
    currentAudio = null;
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showLoading() {
    document.getElementById('messages-container').innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i> Loading messages...
        </div>
    `;
}

function showError(message) {
    // You can implement a toast notification system here
    alert('Error: ' + message);
}

function showSuccess(message) {
    // You can implement a toast notification system here
    alert(message);
}

// Edit and Delete Functions
async function editMessage(messageId) {
    try {
        // Find the message to edit
        const message = allMessages.find(m => m.id === messageId);
        if (!message) {
            showError('Message not found');
            return;
        }

        // Show edit modal
        showEditModal(message);

    } catch (error) {
        console.error('Error editing message:', error);
        showError('Error loading message for editing');
    }
}

async function deleteMessage(messageId, messageTitle) {
    if (!confirm(`Are you sure you want to delete this message?\n\n"${messageTitle}"\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=deleteMessage&messageId=${messageId}`);
        const data = await response.json();

        if (data.success) {
            showSuccess('Message deleted successfully!');
            await loadMessages(); // Reload the list
        } else {
            showError('Delete failed: ' + data.error);
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        showError('Error deleting message. Please try again.');
    }
}

function showEditModal(message) {
    // Create modal HTML
    const modalHtml = `
        <div id="edit-modal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit Message</h2>
                    <button class="close-btn" onclick="closeEditModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="edit-form" onsubmit="saveEditedMessage(event)">
                    <input type="hidden" id="edit-message-id" value="${message.id}">
                    <input type="hidden" id="edit-original-file-id" value="${message.fileId}">
                    
                    <div class="form-group">
                        <label for="edit-message-date">Date:</label>
                        <input type="date" id="edit-message-date" value="${message.date}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-book-name">Book:</label>
                        <select id="edit-book-name" required>
                            <option value="">Select a book</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-chapter-number">Chapter:</label>
                        <input type="number" id="edit-chapter-number" min="1" value="${message.chapter}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-verse-range">Verse Range:</label>
                        <input type="text" id="edit-verse-range" value="${message.verseRange}" placeholder="e.g., 1-10, 15-20" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-audio-file">Replace Audio File (optional):</label>
                        <input type="file" id="edit-audio-file" accept="audio/*">
                        <small>Leave empty to keep current file: ${message.fileName}</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-notes">Notes:</label>
                        <textarea id="edit-notes" placeholder="Additional notes about this message...">${message.notes || ''}</textarea>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Populate book dropdown and set current book
    const editBookSelect = document.getElementById('edit-book-name');
    editBookSelect.innerHTML = '<option value="">Select a book</option>';
    BIBLE_BOOKS.forEach(book => {
        const option = document.createElement('option');
        option.value = book.name;
        option.textContent = book.name;
        option.setAttribute('data-chapters', book.chapters);
        if (book.name === message.book) {
            option.selected = true;
        }
        editBookSelect.appendChild(option);
    });

    // Set up chapter validation
    document.getElementById('edit-book-name').addEventListener('change', function () {
        const selectedBook = this.value;
        const chapterInput = document.getElementById('edit-chapter-number');

        if (selectedBook) {
            const maxChapters = getMaxChapters(selectedBook);
            chapterInput.max = maxChapters;
            chapterInput.placeholder = `1-${maxChapters}`;
        }
    });

    // Trigger initial chapter validation
    document.getElementById('edit-book-name').dispatchEvent(new Event('change'));
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.remove();
    }
}

async function saveEditedMessage(event) {
    event.preventDefault();

    const form = document.getElementById('edit-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        submitBtn.disabled = true;

        // Get form data
        const formData = new FormData();
        formData.append('action', 'editMessage');
        formData.append('messageId', document.getElementById('edit-message-id').value);
        formData.append('originalFileId', document.getElementById('edit-original-file-id').value);
        formData.append('date', document.getElementById('edit-message-date').value);
        formData.append('book', document.getElementById('edit-book-name').value);
        formData.append('chapter', document.getElementById('edit-chapter-number').value);
        formData.append('verseRange', document.getElementById('edit-verse-range').value);
        formData.append('notes', document.getElementById('edit-notes').value);

        // Add audio file only if selected
        const audioFile = document.getElementById('edit-audio-file').files[0];
        if (audioFile) {
            formData.append('audioFile', audioFile);
        }

        // Save to Google Apps Script
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Message updated successfully!');
            closeEditModal();
            await loadMessages(); // Reload the list
        } else {
            showError('Update failed: ' + data.error);
        }

    } catch (error) {
        console.error('Update error:', error);
        showError('Update failed. Please try again.');
    } finally {
        // Restore button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Handle book filter changes to update chapter options
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('book-filter').addEventListener('change', updateFilterOptions);
});