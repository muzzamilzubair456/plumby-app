
// # Update supabase-config.js with real credentials
// supabase_config_updated = '''/**
//  * ============================================================
//  * PLUMBLY APP - SUPABASE CONFIGURATION (PRODUCTION)
//  * ============================================================
//  * Real Supabase project credentials
//  * Project: xvaqnkhsezdyimwnwzay
//  * Region: Auto-selected by Supabase
//  * 
//  * FREE TIER FEATURES:
//  * - 500MB Database (PostgreSQL)
//  * - 2GB Storage
//  * - 50K Monthly Active Users
//  * - Real-time subscriptions
//  * - Row Level Security (RLS)
//  * - Authentication (Email + OAuth)
//  * ============================================================
//  */

// ============================================================
// SUPABASE PROJECT CREDENTIALS (REAL)
// ============================================================
// Project: xvaqnkhsezdyimwnwzay
// Get from: https://app.supabase.com/project/xvaqnkhsezdyimwnwzay/settings/api

const SUPABASE_CONFIG = {
    // Your Supabase project URL
    url: 'https://xvaqnkhsezdyimwnwzay.supabase.co',
    
    // Your Supabase anon/public key (SAFE to expose in frontend)
    // This is a public key - it cannot perform admin operations
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YXFua2hzZXpkeWltd253emF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODQwNDYsImV4cCI6MjA5MzY2MDA0Nn0.wNA1cVgEmhflFAYwab9YQUZ5jSwLnEbJ9wdhlPRgLvM',
    
    // ⚠️ NEVER put service_role key here! Use Edge Functions only.
    serviceRoleKey: null,
    
    // Auth settings optimized for mobile PWA
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'plumbly-auth-token',
        flowType: 'pkce'
    },
    
    // Real-time settings for live tracking
    realtime: {
        reconnectAfterMs: (tries) => Math.min(tries * 1000, 10000),
        timeout: 20000
    },
    
    db: {
        schema: 'public'
    }
};

// ============================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================

let supabaseClient = null;

/**
 * Initialize Supabase client
 * @returns {Object} Supabase client instance
 */
function initSupabase() {
    if (supabaseClient) {
        return supabaseClient;
    }
    
    // Validate configuration
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
        console.error('❌ SUPABASE ERROR: Credentials not configured');
        showConfigBanner();
        return null;
    }
    
    try {
        // Create Supabase client using global supabase object from CDN
        supabaseClient = supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey,
            {
                auth: SUPABASE_CONFIG.auth,
                realtime: SUPABASE_CONFIG.realtime,
                db: SUPABASE_CONFIG.db
            }
        );
        
        console.log('✅ Supabase connected to project: xvaqnkhsezdyimwnwzay');
        return supabaseClient;
        
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error.message);
        showConfigBanner();
        return null;
    }
}

/**
 * Show configuration banner if Supabase not set up
 */
function showConfigBanner() {
    const banner = document.getElementById('config-banner');
    if (banner) {
        banner.classList.remove('hidden');
        banner.innerHTML = `
            <div class="fixed top-0 left-0 right-0 bg-error text-white p-4 z-[100] text-center">
                <p class="font-semibold">⚠️ Supabase Not Configured</p>
                <p class="text-sm">Please set up your Supabase project at app.supabase.com</p>
            </div>
        `;
    }
}

/**
 * Get Supabase client (auto-initializes if needed)
 * @returns {Object} Supabase client
 */
function getSupabase() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
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
// ENUMS (Consistent values across app)
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
    const errorResponse = {
        success: false,
        error: error,
        message: error?.message || 'An unexpected error occurred',
        code: error?.code || 'UNKNOWN',
        context: context,
        timestamp: new Date().toISOString()
    };
    
    console.error(`❌ Supabase Error [${context}]:`, errorResponse);
    return errorResponse;
}

function isAuthError(error) {
    return error?.code?.includes('auth') || 
           error?.message?.includes('auth') ||
           error?.code === 'PGRST301' ||
           error?.status === 401;
}

function isNetworkError(error) {
    return error?.message?.includes('network') ||
           error?.message?.includes('fetch') ||
           error?.message?.includes('timeout') ||
           !navigator.onLine;
}

// ============================================================
// CONNECTION HEALTH CHECK
// ============================================================

async function checkSupabaseHealth() {
    try {
        const supabase = getSupabase();
        if (!supabase) return false;
        
        const { data, error } = await supabase
            .from(DB_TABLES.PROFILES)
            .select('count', { count: 'exact', head: true });
            
        if (error) throw error;
        
        console.log('✅ Supabase connection healthy');
        return true;
        
    } catch (error) {
        console.error('❌ Supabase health check failed:', error.message);
        return false;
    }
}

// ============================================================
// AUTO-INITIALIZATION
// ============================================================

(function autoInit() {
    const isConfigValid = SUPABASE_CONFIG.url && 
                          SUPABASE_CONFIG.anonKey;
    
    if (isConfigValid) {
        initSupabase();
    } else {
        console.warn('⚠️ Supabase config incomplete. Please check credentials.');
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
window.handleSupabaseError = handleSupabaseError;
window.isAuthError = isAuthError;
window.isNetworkError = isNetworkError;
window.checkSupabaseHealth = checkSupabaseHealth;

console.log('📦 supabase-config.js loaded - Project: xvaqnkhsezdyimwnwzay');
