
// # Create the js/app.js file with complete shared utilities
// app_js = '''/**
//  * ============================================================
//  * PLUMBLY APP - SHARED UTILITIES & CORE FUNCTIONS
//  * ============================================================
//  * Central module for all shared functionality:
//  * - UI helpers (loading states, toasts, modals)
//  * - Animation utilities
//  * - Form validation
//  * - Date/time formatting
//  * - Location utilities
//  * - Navigation helpers
//  * - Responsive utilities
//  * - Data formatting
//  * 
//  * Depends on: supabase-config.js, auth.js
//  * ============================================================
//  */

// ============================================================
// APP STATE MANAGEMENT
// ============================================================

const AppState = {
    isOnline: navigator.onLine,
    isLoading: false,
    currentPage: window.location.pathname,
    notifications: [],
    toastQueue: [],
    isProcessingToast: false
};

// ============================================================
// ONLINE/OFFLINE DETECTION
// ============================================================

/**
 * Monitor network status
 * Shows offline banner when connection lost
 */
function initNetworkMonitor() {
    window.addEventListener('online', () => {
        AppState.isOnline = true;
        hideOfflineBanner();
        showToast('Back online', 'success', 2000);
        console.log('🌐 Connection restored');
    });
    
    window.addEventListener('offline', () => {
        AppState.isOnline = false;
        showOfflineBanner();
        showToast('You are offline', 'warning', 0); // Persistent
        console.log('📴 Connection lost');
    });
    
    // Check initial state
    if (!navigator.onLine) {
        showOfflineBanner();
    }
}

function showOfflineBanner() {
    const existing = document.getElementById('offline-banner');
    if (existing) return;
    
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'fixed top-0 left-0 right-0 bg-error text-white p-3 z-[100] text-center animate-slide-down';
    banner.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">wifi_off</span>
            <span class="font-semibold text-sm">No internet connection</span>
        </div>
    `;
    document.body.appendChild(banner);
}

function hideOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (banner) {
        banner.classList.add('animate-slide-up');
        setTimeout(() => banner.remove(), 300);
    }
}

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================

/**
 * Show toast notification
 * @param {string} message - Toast text
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Duration in ms (0 = persistent)
 */
function showToast(message, type = 'info', duration = 3000) {
    // Add to queue
    AppState.toastQueue.push({ message, type, duration });
    
    // Process queue
    if (!AppState.isProcessingToast) {
        processToastQueue();
    }
}

async function processToastQueue() {
    if (AppState.toastQueue.length === 0) {
        AppState.isProcessingToast = false;
        return;
    }
    
    AppState.isProcessingToast = true;
    const { message, type, duration } = AppState.toastQueue.shift();
    
    // Create toast element
    const toast = createToastElement(message, type);
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });
    
    // Auto-dismiss
    if (duration > 0) {
        await new Promise(resolve => setTimeout(resolve, duration));
        dismissToast(toast);
    }
    
    // Process next
    setTimeout(() => processToastQueue(), 100);
}

function createToastElement(message, type) {
    const colors = {
        success: 'bg-[#20c997] text-white',
        error: 'bg-error text-white',
        warning: 'bg-tertiary text-white',
        info: 'bg-primary text-white'
    };
    
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    
    const toast = document.createElement('div');
    toast.className = `fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 min-w-[280px] max-w-[90vw] toast-enter ${colors[type]}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined flex-shrink-0">${icons[type]}</span>
        <span class="font-body-md text-sm">${message}</span>
        <button class="ml-auto flex-shrink-0 opacity-70 hover:opacity-100" onclick="this.parentElement.remove()">
            <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
    `;
    
    return toast;
}

function dismissToast(toast) {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
}

// ============================================================
// LOADING STATES
// ============================================================

/**
 * Show full-screen loading overlay
 * @param {string} message - Loading message
 */
function showLoading(message = 'Loading...') {
    AppState.isLoading = true;
    
    const existing = document.getElementById('app-loading');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'app-loading';
    overlay.className = 'fixed inset-0 z-[80] bg-surface/90 backdrop-blur-sm flex flex-col items-center justify-center';
    overlay.innerHTML = `
        <div class="relative">
            <div class="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <div class="absolute inset-0 flex items-center justify-center">
                <span class="material-symbols-outlined text-primary text-2xl">water_drop</span>
            </div>
        </div>
        <p class="mt-4 font-body-md text-secondary animate-pulse">${message}</p>
    `;
    
    document.body.appendChild(overlay);
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    AppState.isLoading = false;
    const overlay = document.getElementById('app-loading');
    if (overlay) {
        overlay.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => overlay.remove(), 300);
    }
}

/**
 * Set button loading state
 * @param {HTMLElement} button - Button element
 * @param {boolean} isLoading - Loading state
 * @param {string} loadingText - Text during loading
 */
function setButtonLoading(button, isLoading, loadingText = 'Loading...') {
    if (isLoading) {
        button.dataset.originalContent = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `
            <span class="inline-flex items-center gap-2">
                <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <span>${loadingText}</span>
            </span>
        `;
    } else {
        button.disabled = false;
        if (button.dataset.originalContent) {
            button.innerHTML = button.dataset.originalContent;
        }
    }
}

// ============================================================
// FORM VALIDATION
// ============================================================

const ValidationRules = {
    email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Please enter a valid email address'
    },
    phone: {
        pattern: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
        message: 'Please enter a valid phone number'
    },
    password: {
        minLength: 6,
        message: 'Password must be at least 6 characters'
    },
    name: {
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-Z\s\-\']+$/,
        message: 'Please enter a valid name (2-50 characters)'
    },
    address: {
        minLength: 5,
        message: 'Address must be at least 5 characters'
    }
};

/**
 * Validate a single field
 * @param {string} value - Field value
 * @param {string} type - Validation type
 * @returns {Object} { valid: boolean, message: string }
 */
function validateField(value, type) {
    const rule = ValidationRules[type];
    if (!rule) return { valid: true, message: '' };
    
    if (!value || value.trim() === '') {
        return { valid: false, message: 'This field is required' };
    }
    
    if (rule.minLength && value.length < rule.minLength) {
        return { valid: false, message: rule.message };
    }
    
    if (rule.maxLength && value.length > rule.maxLength) {
        return { valid: false, message: `Maximum ${rule.maxLength} characters allowed` };
    }
    
    if (rule.pattern && !rule.pattern.test(value)) {
        return { valid: false, message: rule.message };
    }
    
    return { valid: true, message: '' };
}

/**
 * Validate entire form
 * @param {HTMLFormElement} form - Form element
 * @returns {Object} { valid: boolean, errors: Object }
 */
function validateForm(form) {
    const errors = {};
    let isValid = true;
    
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        const type = input.dataset.validate;
        if (!type) return;
        
        const result = validateField(input.value, type);
        if (!result.valid) {
            errors[input.name] = result.message;
            isValid = false;
            showFieldError(input, result.message);
        } else {
            clearFieldError(input);
        }
    });
    
    return { valid: isValid, errors };
}

function showFieldError(input, message) {
    input.classList.add('border-error', 'ring-1', 'ring-error');
    
    let errorEl = input.parentElement.querySelector('.field-error');
    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.className = 'field-error text-error text-xs mt-1 font-label-sm';
        input.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
    
    // Shake animation
    input.classList.add('animate-shake');
    setTimeout(() => input.classList.remove('animate-shake'), 500);
}

function clearFieldError(input) {
    input.classList.remove('border-error', 'ring-1', 'ring-error');
    const errorEl = input.parentElement.querySelector('.field-error');
    if (errorEl) errorEl.remove();
}

// ============================================================
// DATE & TIME FORMATTING


/**
 * Format date to readable string
 * @param {string|Date} date - Date to format
 * @param {string} format - 'short' | 'long' | 'time' | 'relative'
 * @returns {string}
 */
function formatDate(date, format = 'short') {
    if (!date) return '';
    
    const d = new Date(date);
    const now = new Date();
    
    switch (format) {
        case 'short':
            return d.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
            
        case 'long':
            return d.toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
            });
            
        case 'time':
            return d.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit'
            });
            
        case 'datetime':
            return `${formatDate(date, 'short')} at ${formatDate(date, 'time')}`;
            
        case 'relative':
            const diff = now - d;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return 'Just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            return formatDate(date, 'short');
            
        default:
            return d.toLocaleDateString();
    }
}

/**
 * Format currency
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatCurrency(amount, currency = 'USD') {
    if (amount === null || amount === undefined) return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
}

/**
 * Format distance (km/miles)
 * @param {number} km
 * @returns {string}
 */
function formatDistance(km) {
    if (km < 1) {
        return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
}

/**
 * Format duration (minutes)
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
    if (minutes < 60) {
        return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ============================================================
// LOCATION UTILITIES
// ============================================================

/**
 * Get current GPS location
 * @returns {Promise<Object>} { lat, lng, accuracy }
 */
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                });
            },
            (error) => {
                const messages = {
                    1: 'Location permission denied',
                    2: 'Location unavailable',
                    3: 'Location request timeout'
                };
                reject(new Error(messages[error.code] || 'Location error'));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    });
}

/**
 * Watch location changes (for provider tracking)
 * @param {Function} callback - Called with { lat, lng }
 * @returns {number} Watch ID
 */
function watchLocation(callback) {
    if (!navigator.geolocation) {
        console.error('Geolocation not supported');
        return null;
    }
    
    return navigator.geolocation.watchPosition(
        (position) => {
            callback({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            });
        },
        (error) => console.error('Location watch error:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
}

/**
 * Stop watching location
 * @param {number} watchId
 */
function stopWatchingLocation(watchId) {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
    }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in km
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ============================================================
// NAVIGATION HELPERS
// ============================================================

/**
 * Navigate to page with transition
 * @param {string} url - Target URL
 * @param {Object} params - Query parameters
 */
function navigateTo(url, params = {}) {
    // Add query params
    const urlObj = new URL(url, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        urlObj.searchParams.set(key, value);
    });
    
    // Add page transition
    document.body.classList.add('page-exit');
    
    setTimeout(() => {
        window.location.href = urlObj.toString();
    }, 200);
}

/**
 * Go back with animation
 */
function goBack() {
    document.body.classList.add('page-exit-reverse');
    setTimeout(() => {
        window.history.back();
    }, 200);
}

/**
 * Get URL parameters
 * @returns {URLSearchParams}
 */
function getUrlParams() {
    return new URLSearchParams(window.location.search);
}

/**
 * Get specific URL parameter
 * @param {string} name
 * @returns {string|null}
 */
function getUrlParam(name) {
    return getUrlParams().get(name);
}

// ============================================================
// BOTTOM SHEET / MODAL
// ============================================================

/**
 * Show bottom sheet (mobile-style modal)
 * @param {string} contentId - ID of content element
 * @param {Object} options
 */
function showBottomSheet(contentId, options = {}) {
    const content = document.getElementById(contentId);
    if (!content) return;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm sheet-overlay-enter';
    overlay.onclick = () => hideBottomSheet();
    
    // Clone content
    const sheet = content.cloneNode(true);
    sheet.id = 'active-bottom-sheet';
    sheet.className = 'fixed bottom-0 left-0 right-0 z-[75] bg-surface rounded-t-[32px] p-6 pb-10 max-h-[85vh] overflow-y-auto sheet-enter';
    sheet.hidden = false;
    
    // Add drag handle
    const handle = document.createElement('div');
    handle.className = 'w-12 h-1.5 bg-outline-variant rounded-full mx-auto mb-6';
    sheet.insertBefore(handle, sheet.firstChild);
    
    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
    document.body.style.overflow = 'hidden';
    
    // Animate
    requestAnimationFrame(() => {
        overlay.classList.add('sheet-overlay-visible');
        sheet.classList.add('sheet-visible');
    });
}

function hideBottomSheet() {
    const overlay = document.querySelector('.sheet-overlay-enter');
    const sheet = document.getElementById('active-bottom-sheet');
    
    if (overlay) {
        overlay.classList.remove('sheet-overlay-visible');
        overlay.classList.add('sheet-overlay-exit');
    }
    if (sheet) {
        sheet.classList.remove('sheet-visible');
        sheet.classList.add('sheet-exit');
    }
    
    setTimeout(() => {
        overlay?.remove();
        sheet?.remove();
        document.body.style.overflow = '';
    }, 300);
}

// ============================================================
// CONFIRMATION DIALOG
// ============================================================

/**
 * Show confirmation dialog
 * @param {string} title
 * @param {string} message
 * @param {string} confirmText
 * @param {string} cancelText
 * @returns {Promise<boolean>}
 */
function showConfirm(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 dialog-enter';
        overlay.innerHTML = `
            <div class="bg-surface rounded-3xl p-6 max-w-sm w-full shadow-2xl dialog-content-enter">
                <h3 class="font-h3 text-h3 text-on-surface mb-2">${title}</h3>
                <p class="font-body-md text-secondary mb-6">${message}</p>
                <div class="flex gap-3">
                    <button class="flex-1 py-3 rounded-xl border border-outline-variant font-label-md text-on-surface-variant hover:bg-surface-container transition-colors" onclick="this.closest('.dialog-enter').remove(); window._dialogResolve(false);">
                        ${cancelText}
                    </button>
                    <button class="flex-1 py-3 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-colors" onclick="this.closest('.dialog-enter').remove(); window._dialogResolve(true);">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;
        
        window._dialogResolve = (result) => {
            delete window._dialogResolve;
            resolve(result);
        };
        
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('dialog-visible'));
    });
}

// ============================================================
// ANIMATION UTILITIES
// ============================================================

/**
 * Add stagger animation to list items
 * @param {string} selector - CSS selector for items
 * @param {string} animationClass - Animation class to add
 * @param {number} staggerDelay - Delay between items (ms)
 */
function staggerAnimation(selector, animationClass = 'animate-fade-in-up', staggerDelay = 50) {
    const items = document.querySelectorAll(selector);
    items.forEach((item, index) => {
        item.style.opacity = '0';
        setTimeout(() => {
            item.classList.add(animationClass);
            item.style.opacity = '';
        }, index * staggerDelay);
    });
}

/**
 * Animate number counter
 * @param {HTMLElement} element
 * @param {number} target
 * @param {number} duration
 */
function animateCounter(element, target, duration = 1000) {
    const start = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * easeProgress);
        
        element.textContent = current.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

/**
 * Intersection Observer helper for scroll animations
 * @param {string} selector
 * @param {string} animationClass
 */
function initScrollAnimations(selector = '.animate-on-scroll', animationClass = 'animate-visible') {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add(animationClass);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    
    document.querySelectorAll(selector).forEach(el => observer.observe(el));
}

// ============================================================
// SCROLL UTILITIES
// ============================================================

/**
 * Smooth scroll to element
 * @param {string|HTMLElement} target
 * @param {number} offset
 */
function smoothScrollTo(target, offset = 80) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;
    
    const top = element.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
}

/**
 * Hide header on scroll down, show on scroll up
 * @param {string} headerSelector
 */
function initHideOnScroll(headerSelector = 'header') {
    const header = document.querySelector(headerSelector);
    if (!header) return;
    
    let lastScroll = 0;
    let ticking = false;
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const currentScroll = window.pageYOffset;
                
                if (currentScroll > lastScroll && currentScroll > 100) {
                    header.classList.add('-translate-y-full');
                } else {
                    header.classList.remove('-translate-y-full');
                }
                
                lastScroll = currentScroll;
                ticking = false;
            });
            ticking = true;
        }
    });
}

// ============================================================
// PULL TO REFRESH (Mobile)
// ============================================================

function initPullToRefresh(callback) {
    let startY = 0;
    let isPulling = false;
    const threshold = 100;
    
    const container = document.querySelector('main') || document.body;
    
    container.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
            isPulling = true;
        }
    }, { passive: true });
    
    container.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        
        if (diff > 0 && diff < threshold * 2) {
            container.style.transform = `translateY(${diff * 0.5}px)`;
            
            if (diff > threshold) {
                container.classList.add('pull-ready');
            }
        }
    }, { passive: true });
    
    container.addEventListener('touchend', () => {
        if (!isPulling) return;
        isPulling = false;
        
        if (container.classList.contains('pull-ready')) {
            callback?.();
            showToast('Refreshing...', 'info');
        }
        
        container.style.transform = '';
        container.classList.remove('pull-ready');
    });
}

// ============================================================
// IMAGE UTILITIES
// ============================================================

/**
 * Lazy load images
 * @param {string} selector
 */
function initLazyImages(selector = 'img[data-src]') {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    document.querySelectorAll(selector).forEach(img => observer.observe(img));
}

/**
 * Handle image load error (show placeholder)
 * @param {HTMLImageElement} img
 */
function handleImageError(img) {
    img.onerror = () => {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23e0e3e8" width="100" height="100"/><text fill="%23727787" x="50" y="50" text-anchor="middle" font-size="14">No Image</text></svg>';
        img.onerror = null;
    };
}

// ============================================================
// STORAGE UTILITIES (localStorage wrapper)


const AppStorage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },
    
    remove(key) {
        localStorage.removeItem(key);
    },
    
    clear() {
        localStorage.clear();
    }
};

// ============================================================
// DEBOUNCE & THROTTLE
// ============================================================

function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit = 100) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================================
// DEVICE UTILITIES
// ============================================================

function isMobile() {
    return window.innerWidth < 768 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone || 
           document.referrer.includes('android-app://');
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize all app utilities
 * Called on every page load
 */
function initApp() {
    console.log('🚀 Initializing Plumbly app utilities...');
    
    // Network monitoring
    initNetworkMonitor();
    
    // Scroll animations
    initScrollAnimations();
    
    // Lazy images
    initLazyImages();
    
    // Hide header on scroll
    initHideOnScroll();
    
    // Handle image errors
    document.querySelectorAll('img').forEach(handleImageError);
    
    // Add page enter animation
    document.body.classList.add('page-enter');
    requestAnimationFrame(() => {
        document.body.classList.add('page-enter-active');
    });
    
    console.log('✅ App utilities initialized');
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

// ============================================================
// GLOBAL EXPORTS
// ============================================================

window.AppState = AppState;
window.AppStorage = AppStorage;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.setButtonLoading = setButtonLoading;
window.validateField = validateField;
window.validateForm = validateForm;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;
window.formatDistance = formatDistance;
window.formatDuration = formatDuration;
window.getCurrentLocation = getCurrentLocation;
window.watchLocation = watchLocation;
window.stopWatchingLocation = stopWatchingLocation;
window.calculateDistance = calculateDistance;
window.navigateTo = navigateTo;
window.goBack = goBack;
window.getUrlParams = getUrlParams;
window.getUrlParam = getUrlParam;
window.showBottomSheet = showBottomSheet;
window.hideBottomSheet = hideBottomSheet;
window.showConfirm = showConfirm;
window.staggerAnimation = staggerAnimation;
window.animateCounter = animateCounter;
window.initScrollAnimations = initScrollAnimations;
window.smoothScrollTo = smoothScrollTo;
window.initHideOnScroll = initHideOnScroll;
window.initPullToRefresh = initPullToRefresh;
window.initLazyImages = initLazyImages;
window.handleImageError = handleImageError;
window.debounce = debounce;
window.throttle = throttle;
window.isMobile = isMobile;
window.isIOS = isIOS;
window.isStandalone = isStandalone;
window.initApp = initApp;

console.log('🛠️ app.js loaded - Utilities ready');
// '''

// # Write to file
// with open('/mnt/agents/output/app.js', 'w') as f:
//     f.write(app_js)

// print("✅ js/app.js created successfully!")
// print(f"📄 File size: {len(app_js)} characters")
// print("\n📋 Features included:")
// print("  • Toast Notifications (queued)")
// print("  • Loading States (overlay + button)")
// print("  • Form Validation")
// print("  • Date/Time/Currency Formatting")
// print("  • Location Utilities (GPS, distance)")
// print("  • Bottom Sheet / Modal")
// print("  • Confirmation Dialog")
// print("  • Scroll Animations")
// print("  • Pull to Refresh")
// print("  • Lazy Images")
// print("  • Network Monitor (offline banner)")
// print("  • Debounce/Throttle")
// print("  • Device Detection")
// print("  • AppStorage wrapper")
