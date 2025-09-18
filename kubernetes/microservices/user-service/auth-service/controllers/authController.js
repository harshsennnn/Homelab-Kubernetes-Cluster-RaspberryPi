
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const axios = require("axios");
const path = require('path');

// require("dotenv").config({
//     path: path.join(__dirname, "..", "..", ".env"),
// });


const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const signToken = (user) => {
    return jwt.sign({ user }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

exports.registerUser = async (req, res) => {
    try {
        console.log("Request Body:", req.body);
        const { name, email, contactNumber, password, role } = req.body;

        if (!name || !email || !password || !role || !contactNumber) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data: newUser } = await axios.post('http://user-service:5006/users', {
            name,
            email,
            contactNumber,
            password: hashedPassword,
            role,
            status: "active",
            onboardingComplete: false,
        });

        const token = signToken(newUser);

        return res.status(201).json({
            message: "Registration successful!",
            token,
            user: newUser,
        });

    } catch (err) {
        if (err.response && err.response.status === 409) {
            return res.status(409).json({ message: "User already exists." });
        }
        console.error("Registration Error:", err);
        return res.status(500).json({ message: "Server error during registration." });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: users } = await axios.get(`http://user-service:5006/users?email=${email}`);

        if (!users || users.length === 0) {
            return res.status(400).json({ message: "Invalid credentials." });
        }
        const user = users[0];

        if (user.status === "suspended") {
            return res.status(403).json({
                message: "Your account is suspended. Contact support.",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials." });
        }

        const token = signToken(user);

        return res.status(200).json({
            message: "Login successful!",
            token,
            user,
        });

    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({ message: "Server Error" });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const { data: users } =
            await axios.get(`http://user-service:5006/users?email=${email}`);

        // Always send same response for security
        if (!users || users.length === 0) {
            return res.status(200).json({
                message: "If an account exists, password reset link sent."
            });
        }

        const user = users[0];

        const resetToken = crypto.randomBytes(32).toString("hex");

        await axios.put(
            `http://user-service:5006/users/${user.id}`,
            {
                passwordResetToken: resetToken,
                passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
            }
        );

        const resetUrl =
            `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        await transporter.sendMail({
            from: `"My Industry House" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Password Reset Request",
            html: `
              <p>You requested a password reset.</p>
              <p><a href="${resetUrl}">${resetUrl}</a></p>
              <p>This link expires in 10 minutes.</p>
            `,
        });

        return res.status(200).json({
            message: "If an account exists, password reset link sent.",
        });

    } catch (err) {
        console.error("Forgot Password Error:", err.response?.data || err.message);
        return res.status(500).json({ message: "Server Error" });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        console.log("🔑 Reset request token:", token);

        // ✅ Step 1 - Validate input
        if (!password) {
            return res.status(400).json({
                message: "New password is required."
            });
        }

        // ✅ Step 2 - Fetch user list by token
        const { data: users } = await axios.get(
            `http://user-service:5006/users?passwordResetToken=${token}`
        );

        console.log("USER QUERY RESPONSE:", users);

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({
                message: "❌ Invalid or expired password reset token."
            });
        }

        const user = users[0];

        // ✅ Step 3 - Validate expiry
        if (!user.passwordResetExpires) {
            return res.status(400).json({
                message: "❌ Token expired."
            });
        }

        if (new Date(user.passwordResetExpires) < new Date()) {
            return res.status(400).json({
                message: "❌ Token expired."
            });
        }

        // ✅ Step 4 - Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ Step 5 - Update DB
        await axios.put(
            `http://user-service:5006/users/${user.id}`,
            {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null
            }
        );

        return res.status(200).json({
            message: "✅ Password reset successful. Please log in again."
        });

    } catch (err) {

        console.error("🔥 RESET ERROR FULL DUMP:", {
            msg: err.message,
            stack: err.stack,
            response: err.response?.data,
            status: err.response?.status
        });

        return res.status(500).json({
            message: "SERVER ERROR DURING RESET"
        });
    }
};      