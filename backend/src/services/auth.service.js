/**
 * Zero-Dependency Auth Service (OAuth2 Redirect Flow)
 * ──────────────────────────────────────────────────
 * Does not require google-auth-library or jsonwebtoken.
 * Uses native Node.js 'fetch' and 'crypto'.
 */
import User from "../models/user.model.js";
import crypto from "crypto";

const REDIRECT_URI = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5001/api/auth/google/callback";

/**
 * Generates the Google OAuth2 Authorization URL.
 */
export function getGoogleAuthUrl() {
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const options = {
        redirect_uri: REDIRECT_URI,
        client_id: process.env.GOOGLE_CLIENT_ID,
        access_type: "offline",
        response_type: "code",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email",
        ].join(" "),
    };

    const qs = new URLSearchParams(options).toString();
    return `${rootUrl}?${qs}`;
}

/**
 * Exchanges the code from Google for a token payload.
 */
export async function getGoogleTokenFromCode(code) {
    const url = "https://oauth2.googleapis.com/token";
    const values = {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(values).toString(),
        });

        if (!res.ok) {
            const error = await res.json();
            console.error("❌ [AUTH] Token exchange failed:", error);
            return null;
        }

        const { id_token, access_token } = await res.json();
        return { id_token, access_token };
    } catch (err) {
        console.error("❌ [AUTH] Error fetching tokens:", err.message);
        return null;
    }
}

/**
 * Verifies a Google ID token via Google's TokenInfo API.
 */
export async function verifyGoogleToken(idToken) {
    try {
        const response = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );

        if (!response.ok) {
            console.warn("⚠️ [AUTH] Google token verification failed");
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("❌ [AUTH] Fetch error during verification:", error.message);
        return null;
    }
}

/**
 * Signs a payload into a mock JWT string.
 */
export function signToken(payload) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    const secret = process.env.JWT_SECRET || "smart_irrigation_secret_123";

    const signature = crypto
        .createHmac("sha256", secret)
        .update(`${header}.${body}`)
        .digest("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    return `${header}.${body}.${signature}`;
}

/**
 * Verifies a mock JWT string.
 */
export function verifyToken(token) {
    try {
        const [header, body, signature] = token.split(".");
        const secret = process.env.JWT_SECRET || "smart_irrigation_secret_123";

        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(`${header}.${body}`)
            .digest("base64")
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");

        if (signature !== expectedSignature) return null;

        return JSON.parse(atob(body));
    } catch {
        return null;
    }
}

/**
 * Authenticates user with Google payload.
 */
export async function authenticateWithGoogle(payload) {
    const { sub: googleId, email, name, picture: avatar } = payload;

    let user = await User.findOne({ email });

    if (user) {
        if (!user.googleId) user.googleId = googleId;
        user.avatar = avatar;
        user.lastLogin = new Date();
        await user.save();
    } else {
        user = await User.create({
            googleId,
            email,
            name,
            avatar,
        });
    }

    const token = signToken({
        userId: user._id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    });

    return { user, token };
}

/**
 * Middleware to verify JWT.
 */
export async function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    // Support both Bearer token and cookie for redirect flow
    let token = authHeader && authHeader.split(" ")[1];

    if (!token && req.headers.cookie) {
        const cookies = Object.fromEntries(
            req.headers.cookie.split("; ").map((c) => c.split("="))
        );
        token = cookies.token;
    }

    if (!token) return next();

    const decoded = verifyToken(token);
    if (!decoded) return next();

    try {
        const user = await User.findById(decoded.userId).lean();
        if (user) req.user = user;
        next();
    } catch {
        next();
    }
}
