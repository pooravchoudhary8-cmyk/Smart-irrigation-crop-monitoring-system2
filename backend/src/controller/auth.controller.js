import {
    getGoogleAuthUrl,
    getGoogleTokenFromCode,
    verifyGoogleToken,
    authenticateWithGoogle,
} from "../services/auth.service.js";
import User from "../models/user.model.js";

/**
 * Initiates Google OAuth2 Redirect Flow
 * GET /api/auth/google
 */
export async function initiateGoogleLogin(req, res) {
    // 🛰️ DEVELOPMENT FALLBACK
    // If Client ID is still the placeholder, provide a seamless "Simulated Login" 
    // so the user isn't blocked by Google Cloud setup.
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID")) {
        console.warn("⚠️ [AUTH] Google Client ID is placeholder. Using DEV MOCK LOGIN.");

        const mockPayload = {
            sub: "mock_google_id_123",
            email: "farmer.demo@example.com",
            name: "Prithvi Raj (Demo)",
            picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agro",
        };

        const { user, token } = await authenticateWithGoogle(mockPayload);

        // Set cookie and redirect back to dashboard
        res.cookie("token", token, {
            httpOnly: false,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.redirect("/");
    }

    const url = getGoogleAuthUrl();
    console.log("🔗 [AUTH] Redirecting to Google:", url);
    res.redirect(url);
}

/**
 * Handles Google OAuth2 Callback
 */
export async function googleCallback(req, res) {
    const { code } = req.query;

    if (!code) {
        return res.redirect("/login?error=no_code");
    }

    const tokenData = await getGoogleTokenFromCode(code);
    if (!tokenData || !tokenData.id_token) {
        return res.redirect("/login?error=token_exchange_failed");
    }

    const payload = await verifyGoogleToken(tokenData.id_token);
    if (!payload) {
        return res.redirect("/login?error=invalid_payload");
    }

    try {
        const { user, token } = await authenticateWithGoogle(payload);

        res.cookie("token", token, {
            httpOnly: false,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        console.log(`✅ [AUTH] User logged in via Google: ${user.email}`);
        res.redirect("/");
    } catch (error) {
        console.error("❌ [AUTH] Callback error:", error.message);
        res.redirect("/login?error=auth_failed");
    }
}

export async function googleLogin(req, res) {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "Missing token" });

    const payload = await verifyGoogleToken(idToken);
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const { user, token } = await authenticateWithGoogle(payload);
    res.json({ success: true, user, token });
}

export async function getProfile(req, res) {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    res.json({ user: { ...req.user, id: req.user._id } });
}

export async function updateProfile(req, res) {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const user = await User.findByIdAndUpdate(
            req.user._id, { $set: req.body }, { new: true }
        ).lean();
        res.json({ success: true, user: { ...user, id: user._id } });
    } catch (error) {
        res.status(500).json({ error: "Failed to update profile" });
    }
}
