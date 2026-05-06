
// # Create the js/auth.js file with complete authentication logic
// auth_js = '''/**
//  * ============================================================
//  * PLUMBLY APP - AUTHENTICATION SYSTEM
//  * ============================================================
//  * Handles all auth operations using Supabase Auth
//  * Features:
//  * - Email/Password signup & login
//  * - Google OAuth (free via Supabase)
//  * - Session persistence
//  * - Auto-redirect based on role
//  * - Auth state listener (real-time)
//  * - Password reset
//  * - Logout
//  * 
//  * Depends on: supabase-config.js (must load before this file)
//  * ============================================================
//  */

// ============================================================
// AUTH STATE MANAGEMENT
// ============================================================

/**
 * Current user session data
 * Updated automatically by auth state listener
 */
let currentUser = null;
let currentSession = null;
let currentProfile = null;
let authStateListeners = [];

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize auth system
 * Must be called on every page load
 * Sets up auth state listener and checks existing session
 */
async function initAuth() {
    console.log('🔐 Initializing auth system...');
    
    const supabase = getSupabase();
    if (!supabase) {
        console.error('❌ Cannot init auth: Supabase not available');
        showAuthError('Authentication service unavailable. Please check your connection.');
        return false;
    }
    
    try {
        // Set up auth state listener (fires on login, logout, token refresh)
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔄 Auth state changed:', event);
            
            currentSession = session;
            currentUser = session?.user || null;
            
            // Notify all registered listeners
            notifyAuthListeners(event, session);
            
            // Handle specific events
            switch (event) {
                case 'SIGNED_IN':
                    handleSignIn(session);
                    break;
                case 'SIGNED_OUT':
                    handleSignOut();
                    break;
                case 'TOKEN_REFRESHED':
                    console.log('🔄 Token refreshed successfully');
                    break;
                case 'USER_UPDATED':
                    console.log('👤 User data updated');
                    break;
            }
        });
        
        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            console.log('✅ Existing session found');
            currentSession = session;
            currentUser = session.user;
            
            // Load user profile
            await loadUserProfile(session.user.id);
            
            // Check if we need to redirect based on role
            await handleAuthRedirect();
        } else {
            console.log('ℹ️ No existing session');
            // If not on login/role/index page, redirect to login
            const publicPages = ['/login.html', '/role.html', '/index.html', '/'];
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            
            if (!publicPages.some(page => currentPage.includes(page.replace('/', '')))) {
                console.log('🔄 Redirecting to login (no session)');
                window.location.href = 'login.html';
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Auth initialization error:', error);
        handleSupabaseError(error, 'Auth Init');
        return false;
    }
}

// ============================================================
// SIGN UP (New User Registration)
// ============================================================

/**
 * Register new user with email/password
 * @param {string} email - User email
 * @param {string} password - User password (min 6 chars)
 * @param {string} name - Full name
 * @param {string} phone - Phone number
 * @param {string} role - 'customer' or 'provider'
 * @returns {Object} Result with success flag and data/error
 */
async function signUp(email, password, name, phone, role) {
    console.log('📝 Signing up new user:', email, 'Role:', role);
    
    const supabase = getSupabase();
    if (!supabase) return { success: false, error: 'Supabase not initialized' };
    
    // Validate inputs
    if (!email || !password || !name || !role) {
        return { success: false, error: 'All fields are required' };
    }
    
    if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
    }
    
    if (!['customer', 'provider'].includes(role)) {
        return { success: false, error: 'Invalid role selected' };
    }
    
    try {
        // Show loading state
        setAuthLoading(true);
        
        // Step 1: Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name,
                    phone: phone,
                    role: role
                }
            }
        });
        
        if (authError) throw authError;
        
        if (!authData.user) {
            throw new Error('User creation failed - no user returned');
        }
        
        console.log('✅ Auth user created:', authData.user.id);
        
        // Step 2: Create profile in profiles table
        const { error: profileError } = await supabase
            .from(DB_TABLES.PROFILES)
            .insert({
                id: authData.user.id,
                email: email,
                name: name,
                phone: phone,
                role: role,
                created_at: new Date().toISOString()
            });
        
        if (profileError) {
            console.error('⚠️ Profile creation error (non-critical):', profileError);
            // Don't throw - auth user is created, profile can be created later
        }
        
        // Step 3: Create role-specific record
        if (role === USER_ROLE.CUSTOMER) {
            const { error: customerError } = await supabase
                .from(DB_TABLES.CUSTOMERS)
                .insert({
                    id: authData.user.id,
                    booking_count: 0
                });
            
            if (customerError) console.error('⚠️ Customer record error:', customerError);
            
        } else if (role === USER_ROLE.PROVIDER) {
            const { error: providerError } = await supabase
                .from(DB_TABLES.PROVIDERS)
                .insert({
                    id: authData.user.id,
                    is_online: false,
                    rating: 5.0,
                    total_jobs: 0,
                    verification_status: 'pending'
                });
            
            if (providerError) console.error('⚠️ Provider record error:', providerError);
        }
        
        // Step 4: Store role in localStorage for quick access
        localStorage.setItem('userRole', role);
        localStorage.setItem('userId', authData.user.id);
        
        console.log('✅ Signup complete for role:', role);
        
        return {
            success: true,
            user: authData.user,
            message: 'Account created successfully! Please check your email to verify.',
            needsEmailConfirmation: !authData.session
        };
        
    } catch (error) {
        console.error('❌ Signup error:', error);
        return handleAuthError(error, 'signup');
        
    } finally {
        setAuthLoading(false);
    }
}

// ============================================================
// SIGN IN (Login)
// ============================================================

/**
 * Sign in with email/password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object} Result with success flag
 */
async function signIn(email, password) {
    console.log('🔑 Signing in:', email);
    
    const supabase = getSupabase();
    if (!supabase) return { success: false, error: 'Supabase not initialized' };
    
    if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
    }
    
    try {
        setAuthLoading(true);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        if (!data.user || !data.session) {
            throw new Error('Login failed - no session returned');
        }
        
        console.log('✅ Sign in successful:', data.user.id);
        
        // Store session data
        currentSession = data.session;
        currentUser = data.user;
        
        // Load profile and determine role
        const profile = await loadUserProfile(data.user.id);
        
        if (!profile) {
            console.warn('⚠️ No profile found, checking metadata');
            // Fallback to user metadata
            const role = data.user.user_metadata?.role;
            if (role) {
                localStorage.setItem('userRole', role);
            }
        }
        
        return {
            success: true,
            user: data.user,
            session: data.session,
            redirectTo: await getRedirectUrl()
        };
        
    } catch (error) {
        console.error('❌ Sign in error:', error);
        return handleAuthError(error, 'signin');
        
    } finally {
        setAuthLoading(false);
    }
}

// ============================================================
// GOOGLE OAUTH (Free via Supabase)
// ============================================================

/**
 * Sign in with Google OAuth
 * Opens Google sign-in popup
 * @param {string} role - 'customer' or 'provider' (for new users)
 */
async function signInWithGoogle(role = null) {
    console.log('🔵 Initiating Google OAuth...');
    
    const supabase = getSupabase();
    if (!supabase) return { success: false, error: 'Supabase not initialized' };
    
    try {
        setAuthLoading(true);
        
        // Store intended role for new users (retrieved after OAuth callback)
        if (role) {
            localStorage.setItem('pendingRole', role);
        }
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/role.html',
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });
        
        if (error) throw error;
        
        // Redirect happens automatically for OAuth
        console.log('🔄 OAuth redirect initiated');
        return { success: true, url: data?.url };
        
    } catch (error) {
        console.error('❌ Google OAuth error:', error);
        return handleAuthError(error, 'google-oauth');
        
    } finally {
        setAuthLoading(false);
    }
}

/**
 * Handle OAuth callback after Google redirect
 * Called on role.html page after OAuth returns
 */
async function handleOAuthCallback() {
    console.log('🔄 Handling OAuth callback...');
    
    const supabase = getSupabase();
    if (!supabase) return false;
    
    try {
        // Get current session (set by OAuth redirect)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (!session) {
            console.log('ℹ️ No OAuth session found');
            return false;
        }
        
        currentSession = session;
        currentUser = session.user;
        
        // Check if user already has a profile
        const { data: existingProfile } = await supabase
            .from(DB_TABLES.PROFILES)
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (existingProfile) {
            // Existing user - load profile and redirect
            currentProfile = existingProfile;
            localStorage.setItem('userRole', existingProfile.role);
            localStorage.setItem('userId', session.user.id);
            
            console.log('✅ Existing user logged in via OAuth');
            window.location.href = getDashboardUrl(existingProfile.role);
            return true;
        }
        
        // New user - need to complete registration with role
        const pendingRole = localStorage.getItem('pendingRole');
        
        if (!pendingRole) {
            // Show role selection for new OAuth users
            console.log('👤 New OAuth user - showing role selection');
            return false; // Let role.html handle this
        }
        
        // Create profile with selected role
        await createOAuthProfile(session.user, pendingRole);
        
        return true;
        
    } catch (error) {
        console.error('❌ OAuth callback error:', error);
        return false;
    }
}

/**
 * Create profile for OAuth user
 */
async function createOAuthProfile(user, role) {
    console.log('📝 Creating OAuth profile for role:', role);
    
    const supabase = getSupabase();
    
    const name = user.user_metadata?.full_name || user.user_metadata?.name || 'User';
    const avatar = user.user_metadata?.avatar_url || null;
    
    // Create profile
    await supabase.from(DB_TABLES.PROFILES).insert({
        id: user.id,
        email: user.email,
        name: name,
        role: role,
        avatar_url: avatar
    });
    
    // Create role-specific record
    if (role === USER_ROLE.CUSTOMER) {
        await supabase.from(DB_TABLES.CUSTOMERS).insert({ id: user.id });
    } else {
        await supabase.from(DB_TABLES.PROVIDERS).insert({
            id: user.id,
            is_online: false,
            rating: 5.0,
            total_jobs: 0
        });
    }
    
    localStorage.setItem('userRole', role);
    localStorage.setItem('userId', user.id);
    
    console.log('✅ OAuth profile created');
}

// ============================================================
// SIGN OUT (Logout)
// ============================================================

/**
 * Sign out current user
 * Clears all session data and redirects to login
 */
async function signOut() {
    console.log('👋 Signing out...');
    
    const supabase = getSupabase();
    if (!supabase) return { success: false };
    
    try {
        setAuthLoading(true);
        
        // If provider, set offline status before logout
        if (currentProfile?.role === USER_ROLE.PROVIDER && currentUser) {
            await supabase
                .from(DB_TABLES.PROVIDERS)
                .update({ is_online: false })
                .eq('id', currentUser.id);
        }
        
        const { error } = await supabase.auth.signOut();
        
        if (error) throw error;
        
        // Clear all local state
        currentUser = null;
        currentSession = null;
        currentProfile = null;
        
        // Clear localStorage (except keep role for convenience)
        localStorage.removeItem('userId');
        localStorage.removeItem('pendingRole');
        
        console.log('✅ Signed out successfully');
        
        // Redirect to login
        window.location.href = 'login.html';
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ Sign out error:', error);
        return handleAuthError(error, 'signout');
        
    } finally {
        setAuthLoading(false);
    }
}

// ============================================================
// PASSWORD RESET
// ============================================================

/**
 * Send password reset email
 * @param {string} email - User email
 */
async function resetPassword(email) {
    console.log('📧 Sending password reset to:', email);
    
    const supabase = getSupabase();
    if (!supabase) return { success: false, error: 'Supabase not initialized' };
    
    try {
        setAuthLoading(true);
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/login.html?reset=true'
        });
        
        if (error) throw error;
        
        return {
            success: true,
            message: 'Password reset link sent! Check your email.'
        };
        
    } catch (error) {
        return handleAuthError(error, 'reset-password');
        
    } finally {
        setAuthLoading(false);
    }
}

/**
 * Update password (after reset)
 * @param {string} newPassword - New password
 */
async function updatePassword(newPassword) {
    const supabase = getSupabase();
    if (!supabase) return { success: false };
    
    if (newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
    }
    
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        return { success: true, message: 'Password updated successfully!' };
        
    } catch (error) {
        return handleAuthError(error, 'update-password');
    }
}

// ============================================================
// USER PROFILE MANAGEMENT
// ============================================================

/**
 * Load user profile from database
 * @param {string} userId - User UUID
 * @returns {Object|null} Profile data
 */
async function loadUserProfile(userId) {
    if (!userId) return null;
    
    const supabase = getSupabase();
    if (!supabase) return null;
    
    try {
        const { data, error } = await supabase
            .from(DB_TABLES.PROFILES)
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                console.warn('⚠️ Profile not found for user:', userId);
                return null;
            }
            throw error;
        }
        
        currentProfile = data;
        
        // Store role in localStorage for quick access
        if (data?.role) {
            localStorage.setItem('userRole', data.role);
        }
        
        console.log('✅ Profile loaded:', data.name, 'Role:', data.role);
        return data;
        
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        return null;
    }
}

/**
 * Update user profile
 * @param {Object} updates - Fields to update
 */
async function updateProfile(updates) {
    if (!currentUser) return { success: false, error: 'Not authenticated' };
    
    const supabase = getSupabase();
    if (!supabase) return { success: false };
    
    try {
        const { data, error } = await supabase
            .from(DB_TABLES.PROFILES)
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id)
            .select()
            .single();
        
        if (error) throw error;
        
        currentProfile = data;
        return { success: true, profile: data };
        
    } catch (error) {
        return handleAuthError(error, 'update-profile');
    }
}

// ============================================================
// REDIRECT LOGIC
// ============================================================

/**
 * Get dashboard URL based on role
 * @param {string} role - User role
 * @returns {string} Dashboard URL
 */
function getDashboardUrl(role) {
    switch (role) {
        case USER_ROLE.CUSTOMER:
            return 'customer/dashboard.html';
        case USER_ROLE.PROVIDER:
            return 'provider/dashboard.html';
        default:
            return 'role.html';
    }
}

/**
 * Determine where to redirect after auth
 * @returns {string} URL to redirect to
 */
async function getRedirectUrl() {
    const role = localStorage.getItem('userRole') || currentProfile?.role;
    
    if (role) {
        return getDashboardUrl(role);
    }
    
    // No role set - need to select
    return 'role.html';
}

/**
 * Handle post-signin logic
 */
async function handleSignIn(session) {
    console.log('🎉 User signed in:', session.user.id);
    
    // Load profile
    await loadUserProfile(session.user.id);
    
    // Redirect to appropriate dashboard
    const redirectUrl = await getRedirectUrl();
    
    // Only redirect if we're on login or public page
    const publicPages = ['login.html', 'role.html', 'index.html', ''];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (publicPages.includes(currentPage)) {
        console.log('🔄 Redirecting to:', redirectUrl);
        window.location.href = redirectUrl;
    }
}

/**
 * Handle signout logic
 */
function handleSignOut() {
    console.log('👋 User signed out');
    currentUser = null;
    currentSession = null;
    currentProfile = null;
}

/**
 * Handle auth-based redirects on page load
 */
async function handleAuthRedirect() {
    const role = localStorage.getItem('userRole') || currentProfile?.role;
    const currentPage = window.location.pathname;
    
    // If on login/role/index and already authenticated with role
    if (role && (currentPage.includes('login.html') || currentPage.includes('role.html') || currentPage.endsWith('/'))) {
        const dashboardUrl = getDashboardUrl(role);
        console.log('🔄 Auto-redirecting to dashboard:', dashboardUrl);
        window.location.href = dashboardUrl;
    }
}

// ============================================================
// AUTH GUARD (Route Protection)
// ============================================================

/**
 * Check if user is authenticated
 * Redirects to login if not
 * @param {string} requiredRole - Optional role requirement
 * @returns {boolean}
 */
async function requireAuth(requiredRole = null) {
    const supabase = getSupabase();
    if (!supabase) return false;
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        console.log('🚫 No session - redirecting to login');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return false;
    }
    
    // Check role if specified
    if (requiredRole) {
        const profile = await loadUserProfile(session.user.id);
        
        if (!profile || profile.role !== requiredRole) {
            console.log('🚫 Wrong role - redirecting');
            window.location.href = getDashboardUrl(profile?.role || 'customer');
            return false;
        }
    }
    
    return true;
}

/**
 * Check if current user has specific role
 * @param {string} role
 * @returns {boolean}
 */
function hasRole(role) {
    return currentProfile?.role === role || localStorage.getItem('userRole') === role;
}

/**
 * Check if user is customer
 */
function isCustomer() {
    return hasRole(USER_ROLE.CUSTOMER);
}

/**
 * Check if user is provider
 */
function isProvider() {
    return hasRole(USER_ROLE.PROVIDER);
}

// ============================================================
// AUTH STATE LISTENERS (For real-time UI updates)
// ============================================================

/**
 * Register a callback for auth state changes
 * @param {Function} callback - Function(event, session)
 * @returns {Function} Unsubscribe function
 */
function onAuthStateChange(callback) {
    authStateListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
        authStateListeners = authStateListeners.filter(cb => cb !== callback);
    };
}

/**
 * Notify all registered listeners
 */
function notifyAuthListeners(event, session) {
    authStateListeners.forEach(callback => {
        try {
            callback(event, session);
        } catch (err) {
            console.error('❌ Auth listener error:', err);
        }
    });
}

// ============================================================
// UI HELPERS
// ============================================================

/**
 * Set loading state on auth buttons
 * @param {boolean} isLoading
 */
function setAuthLoading(isLoading) {
    const buttons = document.querySelectorAll('[data-auth-loading]');
    buttons.forEach(btn => {
        if (isLoading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '<span class="animate-spin inline-block mr-2">⟳</span> Loading...';
        } else {
            btn.disabled = false;
            if (btn.dataset.originalText) {
                btn.innerHTML = btn.dataset.originalText;
            }
        }
    });
}

/**
 * Show auth error message
 * @param {string} message
 */
function showAuthError(message) {
    const errorContainer = document.getElementById('auth-error');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorContainer.classList.add('hidden');
        }, 5000);
    }
    
    console.error('🚨 Auth Error:', message);
}

/**
 * Show auth success message
 * @param {string} message
 */
function showAuthSuccess(message) {
    const successContainer = document.getElementById('auth-success');
    if (successContainer) {
        successContainer.textContent = message;
        successContainer.classList.remove('hidden');
        
        setTimeout(() => {
            successContainer.classList.add('hidden');
        }, 5000);
    }
    
    console.log('✅ Auth Success:', message);
}

// ============================================================
// ERROR HANDLING
// ============================================================

/**
 * Handle auth-specific errors with user-friendly messages
 * @param {Object} error - Supabase error
 * @param {string} context - Operation context
 */
function handleAuthError(error, context) {
    let message = error.message || 'An error occurred';
    
    // Map common Supabase auth errors to friendly messages
    const errorMap = {
        'Invalid login credentials': 'Invalid email or password. Please try again.',
        'Email not confirmed': 'Please verify your email before signing in.',
        'User already registered': 'An account with this email already exists.',
        'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
        'Unable to validate email address: invalid format': 'Please enter a valid email address.',
        'AuthApiError: Invalid login credentials': 'Invalid email or password.',
        'jwt expired': 'Your session has expired. Please sign in again.',
        'refresh token not found': 'Your session has expired. Please sign in again.'
    };
    
    const friendlyMessage = errorMap[message] || message;
    
    showAuthError(friendlyMessage);
    
    return {
        success: false,
        error: error,
        message: friendlyMessage,
        context: context
    };
}

// ============================================================
// GETTERS (For accessing current user data)
// ============================================================

function getCurrentUser() { return currentUser; }
function getCurrentSession() { return currentSession; }
function getCurrentProfile() { return currentProfile; }
function getUserId() { return currentUser?.id || localStorage.getItem('userId'); }
function getUserRole() { return currentProfile?.role || localStorage.getItem('userRole'); }

// ============================================================
// INITIALIZE ON LOAD
// ============================================================

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

// Make everything available globally
window.initAuth = initAuth;
window.signUp = signUp;
window.signIn = signIn;
window.signInWithGoogle = signInWithGoogle;
window.handleOAuthCallback = handleOAuthCallback;
window.signOut = signOut;
window.resetPassword = resetPassword;
window.updatePassword = updatePassword;
window.loadUserProfile = loadUserProfile;
window.updateProfile = updateProfile;
window.requireAuth = requireAuth;
window.hasRole = hasRole;
window.isCustomer = isCustomer;
window.isProvider = isProvider;
window.onAuthStateChange = onAuthStateChange;
window.getCurrentUser = getCurrentUser;
window.getCurrentSession = getCurrentSession;
window.getCurrentProfile = getCurrentProfile;
window.getUserId = getUserId;
window.getUserRole = getUserRole;
window.getDashboardUrl = getDashboardUrl;
window.showAuthError = showAuthError;
window.showAuthSuccess = showAuthSuccess;
window.setAuthLoading = setAuthLoading;

console.log('🔐 auth.js loaded - Authentication system ready');
