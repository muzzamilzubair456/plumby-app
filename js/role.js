
// # Create the js/role.js file with complete role selection logic
// role_js = '''/**
//  * ============================================================
//  * PLUMBLY APP - ROLE SELECTION SYSTEM
//  * ============================================================
//  * Handles user role selection (Customer vs Provider)
//  * Features:
//  * - Role selection UI logic
//  * - Store role in localStorage
//  * - Check if role already selected (redirect)
//  * - Handle OAuth callback with pending role
//  * - Animate role cards
//  * - Prevent re-selection for logged-in users
//  * 
//  * Depends on: supabase-config.js, auth.js, app.js
//  * Used by: role.html
//  * ============================================================
//  */

// ============================================================
// ROLE STATE
// ============================================================

const RoleState = {
    selectedRole: null,
    isProcessing: false,
    hasExistingRole: false
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize role selection page
 * Called automatically when role.html loads
 */
async function initRoleSelection() {
    console.log('🎭 Initializing role selection...');
    
    // Check if user is authenticated
    const supabase = getSupabase();
    if (!supabase) {
        showToast('Connection error. Please try again.', 'error');
        return;
    }
    
    try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            // Not logged in - redirect to login first
            console.log('🚫 No session - redirecting to login');
            window.location.href = 'login.html?redirect=role.html';
            return;
        }
        
        // Check if user already has a profile with role
        const { data: profile, error } = await supabase
            .from(DB_TABLES.PROFILES)
            .select('role, name')
            .eq('id', session.user.id)
            .single();
        
        if (profile && profile.role) {
            // User already has a role - redirect to dashboard
            console.log('✅ User already has role:', profile.role);
            RoleState.hasExistingRole = true;
            localStorage.setItem('userRole', profile.role);
            localStorage.setItem('userId', session.user.id);
            
            // Show message and redirect
            showToast(`Welcome back, ${profile.name}! Redirecting...`, 'success');
            
            setTimeout(() => {
                const dashboardUrl = profile.role === USER_ROLE.CUSTOMER 
                    ? 'customer/dashboard.html' 
                    : 'provider/dashboard.html';
                window.location.href = dashboardUrl;
            }, 1500);
            
            return;
        }
        
        // Check for pending role from OAuth
        const pendingRole = localStorage.getItem('pendingRole');
        if (pendingRole) {
            console.log('🔄 Found pending role from OAuth:', pendingRole);
            // Auto-select and proceed
            await selectRole(pendingRole);
            return;
        }
        
        // New user - show role selection UI
        console.log('👤 New user - showing role selection');
        setupRoleCards();
        animateRoleCards();
        
    } catch (error) {
        console.error('❌ Role init error:', error);
        handleSupabaseError(error, 'Role Selection Init');
    }
}

// ============================================================
// ROLE CARD SETUP
// ============================================================

/**
 * Setup click handlers for role cards
 */
function setupRoleCards() {
    const customerCard = document.getElementById('role-customer');
    const providerCard = document.getElementById('role-provider');
    
    if (customerCard) {
        customerCard.addEventListener('click', () => handleRoleClick(USER_ROLE.CUSTOMER));
        customerCard.addEventListener('touchstart', () => {}, { passive: true }); // Enable :active on mobile
    }
    
    if (providerCard) {
        providerCard.addEventListener('click', () => handleRoleClick(USER_ROLE.PROVIDER));
        providerCard.addEventListener('touchstart', () => {}, { passive: true });
    }
    
    // Setup info buttons
    const customerInfo = document.getElementById('info-customer');
    const providerInfo = document.getElementById('info-provider');
    
    if (customerInfo) {
        customerInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            showRoleInfo(USER_ROLE.CUSTOMER);
        });
    }
    
    if (providerInfo) {
        providerInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            showRoleInfo(USER_ROLE.PROVIDER);
        });
    }
}

/**
 * Handle role card click
 * @param {string} role - 'customer' or 'provider'
 */
async function handleRoleClick(role) {
    if (RoleState.isProcessing) return;
    
    // Visual feedback
    highlightRoleCard(role);
    
    // Small delay for animation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Proceed with selection
    await selectRole(role);
}

/**
 * Highlight selected role card
 * @param {string} role
 */
function highlightRoleCard(role) {
    // Remove highlight from all cards
    document.querySelectorAll('.role-card').forEach(card => {
        card.classList.remove('ring-4', 'ring-primary', 'scale-[1.02]');
        card.classList.add('opacity-50');
    });
    
    // Highlight selected
    const selectedCard = document.getElementById(`role-${role}`);
    if (selectedCard) {
        selectedCard.classList.remove('opacity-50');
        selectedCard.classList.add('ring-4', 'ring-primary', 'scale-[1.02]');
    }
}

// ============================================================
// ROLE SELECTION LOGIC
// ============================================================

/**
 * Select role and create profile
 * @param {string} role - 'customer' or 'provider'
 */
async function selectRole(role) {
    if (RoleState.isProcessing) return;
    RoleState.isProcessing = true;
    RoleState.selectedRole = role;
    
    console.log('🎯 Selecting role:', role);
    
    const supabase = getSupabase();
    if (!supabase) {
        showToast('Connection error', 'error');
        RoleState.isProcessing = false;
        return;
    }
    
    try {
        showLoading('Setting up your account...');
        
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            throw new Error('No active session');
        }
        
        const user = session.user;
        const userMetadata = user.user_metadata || {};
        
        // Check if profile already exists
        const { data: existingProfile } = await supabase
            .from(DB_TABLES.PROFILES)
            .select('id')
            .eq('id', user.id)
            .single();
        
        if (existingProfile) {
            // Update existing profile with role
            const { error: updateError } = await supabase
                .from(DB_TABLES.PROFILES)
                .update({ role: role })
                .eq('id', user.id);
            
            if (updateError) throw updateError;
            
        } else {
            // Create new profile
            const { error: profileError } = await supabase
                .from(DB_TABLES.PROFILES)
                .insert({
                    id: user.id,
                    email: user.email,
                    name: userMetadata.name || userMetadata.full_name || 'User',
                    phone: userMetadata.phone || null,
                    role: role,
                    avatar_url: userMetadata.avatar_url || null,
                    created_at: new Date().toISOString()
                });
            
            if (profileError) throw profileError;
        }
        
        // Create role-specific record
        if (role === USER_ROLE.CUSTOMER) {
            await createCustomerRecord(user.id);
        } else {
            await createProviderRecord(user.id);
        }
        
        // Store in localStorage
        localStorage.setItem('userRole', role);
        localStorage.setItem('userId', user.id);
        
        // Clear pending role
        localStorage.removeItem('pendingRole');
        
        console.log('✅ Role selected and profile created:', role);
        
        // Show success and redirect
        hideLoading();
        showToast(`Welcome! You're all set up.`, 'success');
        
        setTimeout(() => {
            const dashboardUrl = role === USER_ROLE.CUSTOMER 
                ? 'customer/dashboard.html' 
                : 'provider/dashboard.html';
            window.location.href = dashboardUrl;
        }, 1000);
        
    } catch (error) {
        console.error('❌ Role selection error:', error);
        hideLoading();
        
        let message = 'Failed to set up account. Please try again.';
        
        if (error.message.includes('duplicate')) {
            message = 'Account already exists. Please sign in.';
        } else if (error.message.includes('network')) {
            message = 'Network error. Please check your connection.';
        }
        
        showToast(message, 'error');
        RoleState.isProcessing = false;
    }
}

/**
 * Create customer record
 * @param {string} userId
 */
async function createCustomerRecord(userId) {
    const supabase = getSupabase();
    
    const { error } = await supabase
        .from(DB_TABLES.CUSTOMERS)
        .insert({
            id: userId,
            booking_count: 0,
            home_address: null,
            home_location: null
        });
    
    if (error && !error.message.includes('duplicate')) {
        console.error('⚠️ Customer record error:', error);
    }
}

/**
 * Create provider record
 * @param {string} userId
 */
async function createProviderRecord(userId) {
    const supabase = getSupabase();
    
    const { error } = await supabase
        .from(DB_TABLES.PROVIDERS)
        .insert({
            id: userId,
            is_online: false,
            rating: 5.0,
            total_jobs: 0,
            services: [],
            hourly_rate: null,
            verification_status: 'pending'
        });
    
    if (error && !error.message.includes('duplicate')) {
        console.error('⚠️ Provider record error:', error);
    }
}

// ============================================================
// ROLE INFO MODAL
// ============================================================

/**
 * Show role information modal
 * @param {string} role
 */
function showRoleInfo(role) {
    const isCustomer = role === USER_ROLE.CUSTOMER;
    
    const title = isCustomer ? 'Customer' : 'Service Provider';
    const description = isCustomer 
        ? 'Book professional plumbers for your home or office. Track your service in real-time.'
        : 'Accept job requests, earn money, and grow your plumbing business.';
    
    const features = isCustomer ? [
        { icon: 'search', text: 'Find nearby plumbers' },
        { icon: 'schedule', text: 'Book appointments' },
        { icon: 'my_location', text: 'Live tracking' },
        { icon: 'payments', text: 'Secure payments' }
    ] : [
        { icon: 'notifications', text: 'Real-time job alerts' },
        { icon: 'trending_up', text: 'Earn per job' },
        { icon: 'star', text: 'Build your rating' },
        { icon: 'schedule', text: 'Flexible hours' }
    ];
    
    const content = document.createElement('div');
    content.innerHTML = `
        <div class="text-center mb-6">
            <div class="w-16 h-16 rounded-2xl ${isCustomer ? 'bg-primary/10' : 'bg-tertiary/10'} flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-[32px] ${isCustomer ? 'text-primary' : 'text-tertiary'}">
                    ${isCustomer ? 'home' : 'plumbing'}
                </span>
            </div>
            <h3 class="font-h2 text-h2 text-on-surface mb-2">${title}</h3>
            <p class="font-body-md text-secondary">${description}</p>
        </div>
        <div class="space-y-3 mb-6">
            ${features.map(f => `
                <div class="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
                    <span class="material-symbols-outlined text-primary">${f.icon}</span>
                    <span class="font-body-md text-on-surface">${f.text}</span>
                </div>
            `).join('')}
        </div>
        <button onclick="hideBottomSheet()" class="w-full py-3 rounded-xl bg-primary text-white font-label-md">
            Got it
        </button>
    `;
    
    // Create temporary container for bottom sheet
    const tempContainer = document.createElement('div');
    tempContainer.id = 'temp-role-info';
    tempContainer.hidden = true;
    tempContainer.appendChild(content);
    document.body.appendChild(tempContainer);
    
    showBottomSheet('temp-role-info');
    
    // Cleanup after close
    setTimeout(() => {
        const checkClosed = setInterval(() => {
            if (!document.getElementById('active-bottom-sheet')) {
                tempContainer.remove();
                clearInterval(checkClosed);
            }
        }, 500);
    }, 1000);
}

// ============================================================
// ANIMATIONS
// ============================================================

/**
 * Animate role cards on page load
 */
function animateRoleCards() {
    const cards = document.querySelectorAll('.role-card');
    
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(40px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.33, 1, 0.68, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 200 + (index * 150));
    });
    
    // Animate header text
    const headerText = document.getElementById('role-header-text');
    if (headerText) {
        headerText.style.opacity = '0';
        headerText.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            headerText.style.transition = 'all 0.5s ease-out';
            headerText.style.opacity = '1';
            headerText.style.transform = 'translateY(0)';
        }, 100);
    }
}

/**
 * Pulse animation for recommended role
 * @param {string} role - 'customer' or 'provider'
 */
function pulseRoleCard(role) {
    const card = document.getElementById(`role-${role}`);
    if (!card) return;
    
    card.classList.add('animate-pulse-slow');
    
    // Add recommended badge
    const badge = document.createElement('div');
    badge.className = 'absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg';
    badge.textContent = 'POPULAR';
    card.style.position = 'relative';
    card.appendChild(badge);
}

// ============================================================
// ROLE SWITCHING (for users who want to change)
//  * ============================================================

/**
 * Switch user role (rare - usually one-time selection)
 * ⚠️ This clears provider/customer data!
 * @param {string} newRole
 */
async function switchRole(newRole) {
    const confirmed = await showConfirm(
        'Switch Account Type?',
        'This will change your account type. Some data may not transfer. Continue?',
        'Switch',
        'Cancel'
    );
    
    if (!confirmed) return;
    
    const supabase = getSupabase();
    const userId = getUserId();
    
    if (!supabase || !userId) {
        showToast('Not authenticated', 'error');
        return;
    }
    
    try {
        showLoading('Switching account type...');
        
        // Update profile
        const { error: profileError } = await supabase
            .from(DB_TABLES.PROFILES)
            .update({ role: newRole })
            .eq('id', userId);
        
        if (profileError) throw profileError;
        
        // Create new role record if doesn't exist
        if (newRole === USER_ROLE.CUSTOMER) {
            const { data: existing } = await supabase
                .from(DB_TABLES.CUSTOMERS)
                .select('id')
                .eq('id', userId)
                .single();
            
            if (!existing) {
                await createCustomerRecord(userId);
            }
        } else {
            const { data: existing } = await supabase
                .from(DB_TABLES.PROVIDERS)
                .select('id')
                .eq('id', userId)
                .single();
            
            if (!existing) {
                await createProviderRecord(userId);
            }
        }
        
        // Update localStorage
        localStorage.setItem('userRole', newRole);
        
        hideLoading();
        showToast('Account type updated!', 'success');
        
        // Redirect to new dashboard
        setTimeout(() => {
            const dashboardUrl = newRole === USER_ROLE.CUSTOMER 
                ? 'customer/dashboard.html' 
                : 'provider/dashboard.html';
            window.location.href = dashboardUrl;
        }, 1000);
        
    } catch (error) {
        hideLoading();
        console.error('❌ Role switch error:', error);
        showToast('Failed to switch. Please try again.', 'error');
    }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if user needs to select role
 * @returns {Promise<boolean>}
 */
async function needsRoleSelection() {
    const supabase = getSupabase();
    if (!supabase) return true;
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return true; // Not logged in
    
    const { data: profile } = await supabase
        .from(DB_TABLES.PROFILES)
        .select('role')
        .eq('id', session.user.id)
        .single();
    
    return !profile?.role; // True if no role set
}

/**
 * Get role display name
 * @param {string} role
 * @returns {string}
 */
function getRoleDisplayName(role) {
    return role === USER_ROLE.CUSTOMER ? 'Customer' : 'Service Provider';
}

/**
 * Get role icon
 * @param {string} role
 * @returns {string}
 */
function getRoleIcon(role) {
    return role === USER_ROLE.CUSTOMER ? 'home' : 'plumbing';
}

// ============================================================
// INITIALIZATION
// ============================================================

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only init if we're on role.html
    if (document.getElementById('role-selection-page') || 
        document.querySelector('.role-card')) {
        initRoleSelection();
    }
});

// ============================================================
// GLOBAL EXPORTS
// ============================================================

window.RoleState = RoleState;
window.initRoleSelection = initRoleSelection;
window.selectRole = selectRole;
window.switchRole = switchRole;
window.showRoleInfo = showRoleInfo;
window.highlightRoleCard = highlightRoleCard;
window.animateRoleCards = animateRoleCards;
window.pulseRoleCard = pulseRoleCard;
window.needsRoleSelection = needsRoleSelection;
window.getRoleDisplayName = getRoleDisplayName;
window.getRoleIcon = getRoleIcon;
window.createCustomerRecord = createCustomerRecord;
window.createProviderRecord = createProviderRecord;

console.log('🎭 role.js loaded - Role selection system ready');
// '''

// # Write to file
// with open('/mnt/agents/output/role.js', 'w') as f:
//     f.write(role_js)

// print("✅ js/role.js created successfully!")
// print(f"📄 File size: {len(role_js)} characters")
// print("\n📋 Features included:")
// print("  • Auto-redirect if already has role")
// print("  • OAuth pending role handling")
// print("  • Role card animations")
// print("  • Role info modal")
// print("  • Profile creation (customer/provider)")
// print("  • Role switching (with confirmation)")
// print("  • Loading states")
// print("  • Error handling")
