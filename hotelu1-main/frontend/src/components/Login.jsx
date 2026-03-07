import React, { useState } from 'react';

import { useNavigate } from "react-router-dom";



const Login = ({ onLogin }) => {

    const navigate = useNavigate();

    const [username, setUsername] = useState('');

    const [password, setPassword] = useState('');

    const [error, setError] = useState('');

    const [loading, setLoading] = useState(false);



    const handleSubmit = async (e) => {

        e.preventDefault();

        setError('');

        setLoading(true);

        try {

            const API_URL = process.env.REACT_APP_API_URL || 'https://hotel-pos-system.onrender.com';

            console.log("Attempting login to:", API_URL);

            const response = await fetch(`${API_URL}/api/login`, {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    username,

                    password

                })

            });



            console.log("Login response status:", response.status);

            const data = await response.json();

            console.log("Login response data:", data);



            if (response.ok && data.success) {

                // Store user and token in localStorage

                localStorage.setItem("token", data.token);

                localStorage.setItem("user", JSON.stringify(data.user));

                

                // Call onLogin if provided

                if (onLogin) {

                    onLogin(data.user, data.token);

                }

                

                // Navigate to dashboard

                navigate("/dashboard");

            } else {

                setError(data.message || "Login failed. Please try again.");

            }

        } catch (err) {

            console.error("Login error:", err);

            setError("Login failed. Please try again.");

        } finally {

            setLoading(false);

        }

    };



    return (

        <div className="min-h-screen relative flex items-center justify-center">

            {/* Background Image */}

            <div className="fixed inset-0 z-0">

                <img 

                    src="/restaurant-bg.jpg" 

                    alt="Restaurant Background" 

                    className="w-full h-full object-cover"

                />

                <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-gray-900/80 to-black/90"></div>

            </div>

            

            {/* Login Form Container */}

            <div className="relative z-10 w-full max-w-md mx-4">

                <div className="bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">

                    {/* Header */}

                    <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-red-600 p-8 text-center relative overflow-hidden">

                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                        <div className="relative z-10">

                            <div className="flex justify-center mb-4">

                                <div className="text-5xl text-white drop-shadow-2xl animate-pulse">

                                    🍽️

                                </div>

                            </div>

                            <h1 className="text-4xl font-bold text-white restaurant-font tracking-wide mb-2">POS System</h1>

                            <p className="text-sm text-orange-100 font-medium">Restaurant Staff Portal</p>

                        </div>

                    </div>



                    {/* Login Form */}

                    <div className="p-8">

                        <h2 className="text-2xl font-bold text-white mb-8 text-center restaurant-font tracking-wide">Welcome Back</h2>



                        <form onSubmit={handleSubmit} className="space-y-6">

                            <div className="space-y-2">

                                <label htmlFor="username" className="block text-white/90 text-sm font-semibold mb-3 tracking-wide">

                                    📋 Username

                                </label>

                                <input

                                    type="text"

                                    id="username"

                                    value={username}

                                    onChange={(e) => setUsername(e.target.value)}

                                    className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 transition-all duration-500 backdrop-blur-sm"

                                    placeholder="Enter your username"

                                    required

                                    disabled={loading}

                                />

                            </div>



                            <div className="space-y-2">

                                <label htmlFor="password" className="block text-white/90 text-sm font-semibold mb-3 tracking-wide">

                                    🔒 Password

                                </label>

                                <input

                                    type="password"

                                    id="password"

                                    value={password}

                                    onChange={(e) => setPassword(e.target.value)}

                                    className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 transition-all duration-500 backdrop-blur-sm"

                                    placeholder="Enter your password"

                                    required

                                    disabled={loading}

                                />

                            </div>



                            {error && (

                                <div className="bg-red-500/20 border border-red-400/50 text-red-200 text-sm p-4 rounded-xl backdrop-blur-sm">

                                    <p className="text-center font-medium">⚠️ {error}</p>

                                </div>

                            )}



                            <button

                                type="submit"

                                disabled={loading}

                                className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 text-white font-bold text-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden group"

                            >

                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>

                                <span className="relative z-10 flex items-center justify-center">

                                    {loading ? (

                                        <>

                                            <span className="animate-spin mr-3 text-xl">⚪</span>

                                            Authenticating...

                                        </>

                                    ) : (

                                        <>

                                            <span className="mr-2">🚀</span>

                                            Login to Dashboard

                                        </>

                                    )}

                                </span>

                            </button>

                        </form>



                        {/* Demo Credentials */}

                        <div className="mt-8 p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">

                            <p className="text-sm font-bold text-white/90 mb-4 text-center tracking-wide">🔑 Demo Credentials:</p>

                            <div className="space-y-3">

                                <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">

                                    <span className="font-semibold text-white/80 text-sm">Admin:</span>

                                    <span className="text-orange-300 font-mono text-sm bg-black/20 px-3 py-1 rounded-lg">admin / admin</span>

                                </div>

                                <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">

                                    <span className="font-semibold text-white/80 text-sm">Manager:</span>

                                    <span className="text-orange-300 font-mono text-sm bg-black/20 px-3 py-1 rounded-lg">manager / pass2</span>

                                </div>

                                <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">

                                    <span className="font-semibold text-white/80 text-sm">Waiter:</span>

                                    <span className="text-orange-300 font-mono text-sm bg-black/20 px-3 py-1 rounded-lg">waiter / pass</span>

                                </div>

                                <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">

                                    <span className="font-semibold text-white/80 text-sm">Chef:</span>

                                    <span className="text-orange-300 font-mono text-sm bg-black/20 px-3 py-1 rounded-lg">chef / pass1</span>

                                </div>

                            </div>

                        </div>



                        {/* Back Link */}

                        <div className="mt-8 text-center">

                            <a href="/" className="text-orange-300 hover:text-orange-200 text-sm font-semibold flex items-center justify-center transition-all duration-300 hover:scale-105 inline-flex">

                                <span className="mr-2">←</span>

                                Back to Restaurant

                            </a>

                        </div>

                    </div>

                </div>

            </div>

        </div>

    );

};



export default Login;

