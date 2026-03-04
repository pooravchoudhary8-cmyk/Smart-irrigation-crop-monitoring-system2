import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        googleId: {
            type: String,
            unique: true,
            sparse: true, // Only for Google-authenticated users
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        avatar: {
            type: String,
        },
        username: {
            type: String,
            unique: true,
            sparse: true,
        },
        contact: String,
        location: String,
        cropType: String,
        soilType: String,
        cropStage: String,
        lastLogin: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
