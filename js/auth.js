
// # Create auth.js with proper Google OAuth handling
// auth_js = '''/**
//  * ============================================================
//  * PLUMBLY APP - AUTHENTICATION SYSTEM
//  * ============================================================
//  * Handles: Login, Signup, Google OAuth, Password Reset
//  * ============================================================
//  */

// ============================================================
// AUTH STATE
// ============================================================
let authState = {
    user: null,
    session: null,
    profile: null,
    isLoading: false
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 Initializing auth system...');
    initAuth();
});

async function initAuth() {
    try {
        // Wait for Supabase to be ready
        let retries = 0;
        while (!window.getSupabase && retries < 50) {
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }
        
        if (!window.getSupabase) {
            console.error('❌ Supabase not available after timeout');
            return;
        }
        
        const supabase = getSupabase();
        if (!supabase) {
            console.error('❌ Supabase client not initialized');
            return;
        }
        
        console.log('✅ Auth system initialized');
        
        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            authState.session = session;
            authState.user = session.user;
            console.log('👤 User already logged in:', session.user.email);
            
            // Load user profile
            await loadUserProfile(session.user.id);
            
            // Handle auth redirect if needed
            await handleAuthRedirect();
        }
        
        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔄 Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session) {
                authState.user = session.user;
                authState.session = session;
                await loadUserProfile(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                authState.user = null;
                authState.session = null;
                authState.profile = null;
            }
        });
        
    } catch (error) {
        console.error('❌ Auth init error:', error);
    }
}

// ============================================================
// EMAIL/PASSWORD AUTH
// ============================================================

async function signIn(email, password) {
    try {
        showAuthLoading(true);
        
        const supabase = getSupabase();
        if (!supabase) {
            return { success: false, message: 'Supabase not initialized' };
        }
        
        console.log('🔐 Signing in:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        authState.user = data.user;
        authState.session = data.session;
        
        // Load profile
        await loadUserProfile(data.user.id);
        
        console.log('✅ Sign in successful');
        
        return {
            success: true,
            user: data.user,
            redirectTo: getDashboardUrl(data.user)
        };
        
    } catch (error) {
        console.error('❌ Sign in error:', error);
        return { success: false, message: error.message };
    } finally {
        showAuthLoading(false);
    }
}

async function signUp(email, password, name, phone, role = 'customer') {
    try {
        showAuthLoading(true);
        
        const supabase = getSupabase();
        if (!supabase) {
            return { success: false, message: 'Supabase not initialized' };
        }
        
        console.log('📝 Signing up:', email, 'Role:', role);
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    phone: phone,
                    role: role
                }
            }
        });
        
        if (error) throw error;
        
        // Create profile in database
        if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    full_name: name,
                    email: email,
                    phone: phone,
                    role: role,
                    created_at: new Date().toISOString()
                });
            
            if (profileError) {
                console.error('Profile creation error:', profileError);
            }
        }
        
        console.log('✅ Sign up successful');
        
        return {
            success: true,
            user: data.user,
            needsEmailConfirmation: !data.session
        };
        
    } catch (error) {
        console.error('❌ Sign up error:', error);
        return { success: false, message: error.message };
    } finally {
        showAuthLoading(false);
    }
}

async function resetPassword(email) {
    try {
        showAuthLoading(true);
        
        const supabase = getSupabase();
        if (!supabase) {
            return { success: false, message: 'Supabase not initialized' };
        }
        
        const redirectUrl = window.location.origin + '/reset-password.html';
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl
        });
        
        if (error) throw error;
        
        return {
            success: true,
            message: 'Password reset link sent to your email'
        };
        
    } catch (error) {
        console.error('❌ Reset password error:', error);
        return { success: false, message: error.message };
    } finally {
        showAuthLoading(false);
    }
}

// ============================================================
// GOOGLE OAUTH (FIXED)
// ============================================================

async function signInWithGoogle(role = null) {
    try {
        showAuthLoading(true);
        
        const supabase = getSupabase();
        if (!supabase) {
            return { success: false, message: 'Supabase not initialized' };
        }
        
        // Get current URL for redirect
        const currentUrl = window.location.origin;
        const currentPath = window.location.pathname;
        
        // Store role in localStorage for after redirect
        if (role) {
            localStorage.setItem('pendingRole', role);
        }
        
        console.log('🔐 Starting Google OAuth...');
        console.log('📍 Current URL:', currentUrl);
        console.log('📍 Current Path:', currentPath);
        
        // IMPORTANT: Use the EXACT URL that's in Supabase config
        // For localhost, use the full URL
        const redirectTo = currentUrl + currentPath;
        
        console.log('📍 Redirect To:', redirectTo);
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });
        
        if (error) throw error;
        
        console.log('✅ Google OAuth URL:', data.url);
        
        // Redirect to Google
        if (data.url) {
            window.location.href = data.url;
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ Google Sign In Error:', error);
        showAuthError('Google sign in failed: ' + error.message);
        return { success: false, message: error.message };
    } finally {
        showAuthLoading(false);
    }
}

// ============================================================
// HANDLE AUTH REDIRECT (After Google OAuth)
// ============================================================

async function handleAuthRedirect() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check if there's an error in URL
        if (urlParams.has('error')) {
            const errorCode = urlParams.get('error_code');
            const errorDesc = urlParams.get('error_description');
            console.error('❌ Auth error in URL:', errorCode, errorDesc);
            showAuthError('Authentication failed: ' + (errorDesc || errorCode));
            
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return false;
        }
        
        // Check if we have a code (OAuth callback)
        if (urlParams.has('code')) {
            console.log('🔐 Processing OAuth callback...');
            
            const supabase = getSupabase();
            if (!supabase) return false;
            
            // Supabase automatically handles the code exchange
            // We just need to get the session
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) throw error;
            
            if (session) {
                console.log('✅ OAuth successful, user:', session.user.email);
                
                // Check if profile exists
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                
                if (!existingProfile) {
                    // Get role from localStorage or default to customer
                    const pendingRole = localStorage.getItem('pendingRole') || 'customer';
                    localStorage.removeItem('pendingRole');
                    
                    // Create new profile
                    const { error: insertError } = await supabase
                        .from('profiles')
                        .insert({
                            id: session.user.id,
                            full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
                            email: session.user.email,
                            role: pendingRole,
                            avatar_url: session.user.user_metadata?.avatar_url,
                            created_at: new Date().toISOString()
                        });
                    
                    if (insertError) {
                        console.error('Error creating profile:', insertError);
                    }
                }
                
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Redirect to dashboard
                const redirectUrl = getDashboardUrl(session.user);
                console.log('🚀 Redirecting to:', redirectUrl);
                window.location.href = redirectUrl;
                
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('❌ Auth redirect error:', error);
        showAuthError('Authentication error: ' + error.message);
        return false;
    }
}

// ============================================================
// USER PROFILE
// ============================================================

async function loadUserProfile(userId) {
    try {
        const supabase = getSupabase();
        if (!supabase) return;
        
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Error loading profile:', error);
            return;
        }
        
        authState.profile = data;
        console.log('👤 Profile loaded:', data);
        
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// ============================================================
// HELPERS
// ============================================================

function getDashboardUrl(user) {
    const role = authState.profile?.role || user.user_metadata?.role || 'customer';
    
    if (role === 'provider') {
        return 'provider/dashboard.html';
    }
    return 'index.html';
}

function showAuthLoading(show) {
    document.querySelectorAll('[data-auth-loading]').forEach(btn => {
        if (show) {
            btn.disabled = true;
            btn.innerHTML = '<span class="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>Loading...';
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalText || btn.textContent;
        }
    });
}

function showAuthError(message) {
    const banner = document.getElementById('auth-error');
    if (banner) {
        const text = document.getElementById('auth-error-text');
        if (text) text.textContent = message;
        banner.classList.remove('hidden');
        setTimeout(() => banner.classList.add('hidden'), 5000);
    }
}

function showAuthSuccess(message) {
    const banner = document.getElementById('auth-success');
    if (banner) {
        const text = document.getElementById('auth-success-text');
        if (text) text.textContent = message;
        banner.classList.remove('hidden');
        setTimeout(() => banner.classList.add('hidden'), 5000);
    }
}

function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function validateField(value, type) {
    switch (type) {
        case 'email':
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!value) return { valid: false, message: 'Email is required' };
            if (!emailRegex.test(value)) return { valid: false, message: 'Invalid email format' };
            return { valid: true };
            
        case 'password':
            if (!value) return { valid: false, message: 'Password is required' };
            if (value.length < 6) return { valid: false, message: 'Password must be at least 6 characters' };
            return { valid: true };
            
        case 'name':
            if (!value || value.trim().length < 2) return { valid: false, message: 'Name must be at least 2 characters' };
            return { valid: true };
            
        case 'phone':
            if (!value) return { valid: true }; // Optional
            const phoneRegex = /^[+]?[\\d\\s-]{10,}$/;
            if (!phoneRegex.test(value)) return { valid: false, message: 'Invalid phone number' };
            return { valid: true };
            
        default:
            return { valid: true };
    }
}

console.log('🔐 auth.js loaded - Authentication system ready');
// '''

// with open('/mnt/agents/output/auth.js', 'w') as f:
//     f.write(auth_js)

// print("✅ auth.js created with Google OAuth fix!")
// print(f"📄 Size: {len(auth_js)} characters")
