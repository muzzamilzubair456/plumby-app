// ============================================================
// SUPABASE PROJECT CREDENTIALS
// ============================================================
const SUPABASE_CONFIG = {
    url: 'https://xvaqnkhsezdyimwnwzay.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YXFua2hzZXpkeWltd253emF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODQwNDYsImV4cCI6MjA5MzY2MDA0Nn0.wNA1cVgEmhflFAYwab9YQUZ5jSwLnEbJ9wdhlPRgLvM',
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'plumbly-auth-token',
        flowType: 'pkce'
    },
    realtime: {
        reconnectAfterMs: (tries) => Math.min(tries * 1000, 10000),
        timeout: 20000
    },
    db: { schema: 'public' }
};

// ============================================================
// REDIRECT URL CONFIGURATION
// ============================================================
// Auto-detect current URL for redirects
function getRedirectUrl() {
    // Get current origin (e.g., http://localhost:5500)
    const currentUrl = window.location.origin;
    
    // List of allowed redirect URLs (must match Supabase config)
    const allowedUrls = [
        'http://localhost:3000',
        'http://localhost:5500',
        'http://localhost:8080',
        'http://127.0.0.1:5500',
        'http://127.0.0.1:3000'
    ];
    
    // If current URL is in allowed list, use it
    if (allowedUrls.includes(currentUrl)) {
        return currentUrl;
    }
    
    // Default fallback
    return 'http://localhost:5500';
}

// ============================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================
let supabaseClient = null;

function initSupabase() {
    if (supabaseClient) return supabaseClient;
    
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
        console.error('❌ SUPABASE ERROR: Credentials not configured');
        return null;
    }
    
    try {
        supabaseClient = supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey,
            {
                auth: {
                    ...SUPABASE_CONFIG.auth,
                    // Set redirect URL for OAuth
                    redirectTo: getRedirectUrl()
                },
                realtime: SUPABASE_CONFIG.realtime,
                db: SUPABASE_CONFIG.db
            }
        );
        console.log('✅ Supabase connected:', SUPABASE_CONFIG.url);
        console.log('📍 Redirect URL:', getRedirectUrl());
        return supabaseClient;
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error.message);
        return null;
    }
}

function getSupabase() {
    if (!supabaseClient) return initSupabase();
    return supabaseClient;
}

// ============================================================
// GOOGLE SIGN IN WITH PROPER REDIRECT
// ============================================================
async function signInWithGoogle(role = null) {
    try {
        const supabase = getSupabase();
        if (!supabase) {
            return { success: false, message: 'Supabase not initialized' };
        }
        
        const redirectUrl = getRedirectUrl();
        console.log('🔐 Starting Google OAuth...');
        console.log('📍 Redirect URL:', redirectUrl);
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                },
                // Pass role as state parameter
                ...(role && { state: JSON.stringify({ role }) })
            }
        });
        
        if (error) throw error;
        
        console.log('✅ Google OAuth initiated');
        return { success: true, url: data.url };
        
    } catch (error) {
        console.error('❌ Google Sign In Error:', error);
        return { success: false, message: error.message };
    }
}

// ============================================================
// HANDLE AUTH CALLBACK (After Google Redirect)
// ============================================================
async function handleAuthCallback() {
    try {
        const supabase = getSupabase();
        if (!supabase) return false;
        
        // Check if we have a session (Supabase auto-handles the code exchange)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            console.log('✅ User authenticated:', session.user.email);
            
            // Get role from URL state or metadata
            const urlParams = new URLSearchParams(window.location.search);
            const state = urlParams.get('state');
            let role = 'customer';
            
            if (state) {
                try {
                    const stateData = JSON.parse(state);
                    role = stateData.role || 'customer';
                } catch (e) {
                    console.log('Could not parse state');
                }
            }
            
            // Check if profile exists
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
            
            if (!profile) {
                // Create new profile
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: session.user.id,
                        full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
                        email: session.user.email,
                        role: role,
                        avatar_url: session.user.user_metadata?.avatar_url,
                        created_at: new Date().toISOString()
                    });
                
                if (insertError) console.error('Error creating profile:', insertError);
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Auth callback error:', error);
        return false;
    }
}

// ============================================================
// DATABASE TABLE NAMES
// ============================================================
const DB_TABLES = {
    PROFILES: 'profiles',
    CUSTOMERS: 'customers',
    PROVIDERS: 'providers',
    BOOKINGS: 'bookings',
    LOCATIONS: 'locations',
    MESSAGES: 'messages',
    REVIEWS: 'reviews'
};

// ============================================================
// ENUMS
// ============================================================
const BOOKING_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    STARTED: 'started',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

const USER_ROLE = {
    CUSTOMER: 'customer',
    PROVIDER: 'provider'
};

const SERVICE_TYPES = {
    EMERGENCY: 'emergency',
    REPAIR: 'repair',
    LEAKAGE: 'leakage',
    INSTALLATION: 'installation',
    MAINTENANCE: 'maintenance',
    DRAIN_CLEANING: 'drain_cleaning',
    PIPE_REPAIR: 'pipe_repair',
    WATER_HEATER: 'water_heater'
};

const SERVICE_DISPLAY_NAMES = {
    [SERVICE_TYPES.EMERGENCY]: 'Emergency',
    [SERVICE_TYPES.REPAIR]: 'Repair',
    [SERVICE_TYPES.LEAKAGE]: 'Leakage',
    [SERVICE_TYPES.INSTALLATION]: 'Installation',
    [SERVICE_TYPES.MAINTENANCE]: 'Maintenance',
    [SERVICE_TYPES.DRAIN_CLEANING]: 'Drain Cleaning',
    [SERVICE_TYPES.PIPE_REPAIR]: 'Pipe Repair',
    [SERVICE_TYPES.WATER_HEATER]: 'Water Heater'
};

const SERVICE_ICONS = {
    [SERVICE_TYPES.EMERGENCY]: 'emergency',
    [SERVICE_TYPES.REPAIR]: 'build',
    [SERVICE_TYPES.LEAKAGE]: 'water_damage',
    [SERVICE_TYPES.INSTALLATION]: 'plumbing',
    [SERVICE_TYPES.MAINTENANCE]: 'construction',
    [SERVICE_TYPES.DRAIN_CLEANING]: 'cleaning_services',
    [SERVICE_TYPES.PIPE_REPAIR]: 'plumbing',
    [SERVICE_TYPES.WATER_HEATER]: 'water_heater'
};

// ============================================================
// ERROR HANDLING
// ============================================================
function handleSupabaseError(error, context = 'Unknown') {
    console.error(`❌ Supabase Error [${context}]:`, error);
    return { success: false, error, message: error?.message || 'An unexpected error occurred', code: error?.code || 'UNKNOWN' };
}

function isAuthError(error) {
    return error?.code?.includes('auth') || error?.code === 'PGRST301' || error?.status === 401;
}

// ============================================================
// CONNECTION HEALTH CHECK
// ============================================================
async function checkSupabaseHealth() {
    try {
        const supabase = getSupabase();
        if (!supabase) return false;
        const { error } = await supabase.from(DB_TABLES.PROFILES).select('count', { count: 'exact', head: true });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Supabase health check failed:', error.message);
        return false;
    }
}

// ============================================================
// USER HELPERS
// ============================================================
async function getCurrentUser() {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
}

async function getUserProfile(userId) {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) return null;
    return data;
}

async function updateUserProfile(userId, updates) {
    const supabase = getSupabase();
    if (!supabase) return { success: false };
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
    if (error) return { success: false, error };
    return { success: true, data };
}

async function uploadAvatar(userId, file) {
    const supabase = getSupabase();
    if (!supabase) return { success: false };
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('avatars').upload(fileName, file);
    if (error) return { success: false, error };
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return { success: true, url: publicUrl };
}

async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return { success: false };
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, error };
    return { success: true };
}

// ============================================================
// AUTO-INITIALIZATION & CALLBACK HANDLING
// ============================================================
(function autoInit() {
    if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
        initSupabase();
        
        // Check if this is an auth callback (URL has code or error)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('code') || urlParams.has('error')) {
            console.log('🔐 Detected auth callback, processing...');
            handleAuthCallback().then(success => {
                if (success) {
                    // Clean URL and redirect to home
                    window.history.replaceState({}, document.title, window.location.pathname);
                    window.location.href = 'index.html';
                }
            });
        }
    }
})();

// ============================================================
// GLOBAL EXPORTS
// ============================================================
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.DB_TABLES = DB_TABLES;
window.BOOKING_STATUS = BOOKING_STATUS;
window.USER_ROLE = USER_ROLE;
window.SERVICE_TYPES = SERVICE_TYPES;
window.SERVICE_DISPLAY_NAMES = SERVICE_DISPLAY_NAMES;
window.SERVICE_ICONS = SERVICE_ICONS;
window.getSupabase = getSupabase;
window.initSupabase = initSupabase;
window.getRedirectUrl = getRedirectUrl;
window.signInWithGoogle = signInWithGoogle;
window.handleAuthCallback = handleAuthCallback;
window.handleSupabaseError = handleSupabaseError;
window.isAuthError = isAuthError;
window.checkSupabaseHealth = checkSupabaseHealth;
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
window.updateUserProfile = updateUserProfile;
window.uploadAvatar = uploadAvatar;
window.signOut = signOut;

console.log('📦 supabase-config.js loaded - Project: xvaqnkhsezdyimwnwzay');
console.log('📍 Current URL:', window.location.origin);
