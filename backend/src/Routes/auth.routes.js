import express from "express";
import {
    initiateGoogleLogin,
    googleCallback,
    googleLogin,
    getProfile,
    updateProfile,
} from "../controller/auth.controller.js";
import { authenticateJWT } from "../services/auth.service.js";

const router = express.Router();

/**
 * Google OAuth Login
 * GET /api/auth/google initiates redirect
 * GET /api/auth/google/callback handles the return
 * POST /api/auth/google handles direct token verification
 */
router.get("/auth/google", initiateGoogleLogin);
router.get("/auth/google/callback", googleCallback);
router.post("/auth/google", googleLogin);

/**
 * Demo / Manual Login
 */
router.post("/auth/demo-login", (req, res) => {
    // Return a dummy user if it's just a demo
    res.json({
        user: {
            id: "demo_123",
            name: "Demo Farmer",
            email: req.body.email || "demo@agrosense.com",
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Agro"
        },
        token: "demo_token_xyz"
    });
});

/**
 * Get Current User info
 * GET /api/auth/me
 */
router.get("/auth/me", authenticateJWT, getProfile);

/**
 * Update User Profile
 * PATCH /api/auth/profile
 */
router.patch("/auth/profile", authenticateJWT, updateProfile);

/**
 * Logout (Frontend should clear the token, backend is stateless)
 */
router.post("/auth/logout", (req, res) => {
    res.json({ success: true, message: "Logged out successfully" });
});

export default router;
