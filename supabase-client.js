(() => {
    const config = window.HMC_CONFIG || {};
    const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
    const client = isConfigured
        ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
        : null;
    const functionsUrl = isConfigured ? `${config.supabaseUrl.replace(/\/$/, '')}/functions/v1` : '';

    window.hmcSupabase = {
        enabled: isConfigured,
        async login(username, password) {
            const response = await fetch(`${functionsUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: config.supabaseAnonKey },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión');
            const { error } = await client.auth.setSession({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
            });
            if (error) throw error;
            return data.user;
        },
        async logout() {
            if (client) await client.auth.signOut();
        },
        async request(path, options = {}) {
            if (!client) throw new Error('Supabase todavía no está configurado');
            const { data: { session } } = await client.auth.getSession();
            if (!session) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
            const response = await fetch(`${functionsUrl}/${path}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    apikey: config.supabaseAnonKey,
                    Authorization: `Bearer ${session.access_token}`,
                    ...(options.headers || {})
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error de comunicación con Supabase');
            return data;
        },
        async currentUser() {
            if (!client) return null;
            const { data: { user } } = await client.auth.getUser();
            return user || null;
        }
    };
})();
