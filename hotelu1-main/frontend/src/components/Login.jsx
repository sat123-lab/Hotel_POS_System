import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { getAPI_URL } from '../utils/api';



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

            const response = await fetch(`${getAPI_URL()}/api/login`, {

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
        <div className="min-h-screen relative flex items-center justify-center bg-[#FFF8F0]">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-200/50 via-orange-100/30 to-amber-200/50"></div>
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 25% 25%, rgba(249, 115, 22, 0.1) 0%, transparent 50%), 
                                      radial-gradient(circle at 75% 75%, rgba(251, 146, 60, 0.1) 0%, transparent 50%)`
                }}></div>
            </div>

            {/* Login Card */}
            <div className="relative w-full max-w-md mx-4 animate-slide-up">
                <div className="bg-white rounded-3xl shadow-2xl border border-orange-100 overflow-hidden">

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

                                    className="w-full px-5 py-4 bg-white/95 border-2 border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 transition-all duration-500"

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

                                    className="w-full px-5 py-4 bg-white/95 border-2 border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 transition-all duration-500"

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

                        <div className="mt-8 p-6 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl border-2 border-orange-400/50 shadow-lg shadow-orange-500/20">

                            <p className="text-base font-bold text-orange-300 mb-4 text-center tracking-wide">🔑 Demo Credentials (Click to Auto-fill):</p>

                            <div className="space-y-3">

                                <div 
                                    onClick={() => { setUsername('admin'); setPassword('admin'); }}
                                    className="flex justify-between items-center bg-gradient-to-r from-orange-500/30 to-red-500/30 p-4 rounded-xl border-2 border-orange-400/50 backdrop-blur-sm cursor-pointer hover:from-orange-500/50 hover:to-red-500/50 hover:scale-[1.02] hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-300 group"
                                >

                                    <span className="font-bold text-white text-base">👤 Admin:</span>

                                    <span className="text-yellow-300 font-mono text-base font-bold bg-black/40 px-4 py-2 rounded-lg border border-orange-400/30 group-hover:bg-black/60 transition-all">admin / admin</span>

                                </div>

                                <div 
                                    onClick={() => { setUsername('manager'); setPassword('pass2'); }}
                                    className="flex justify-between items-center bg-white/15 p-3 rounded-xl border border-white/20 backdrop-blur-sm cursor-pointer hover:bg-white/25 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 group"
                                >

                                    <span className="font-semibold text-white/90 text-sm">👤 Manager:</span>

                                    <span className="text-orange-300 font-mono text-sm font-bold bg-black/30 px-3 py-1 rounded-lg group-hover:bg-black/50 transition-all">manager / pass2</span>

                                </div>

                                <div 
                                    onClick={() => { setUsername('waiter'); setPassword('pass'); }}
                                    className="flex justify-between items-center bg-white/15 p-3 rounded-xl border border-white/20 backdrop-blur-sm cursor-pointer hover:bg-white/25 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 group"
                                >

                                    <span className="font-semibold text-white/90 text-sm">👤 Waiter:</span>

                                    <span className="text-orange-300 font-mono text-sm font-bold bg-black/30 px-3 py-1 rounded-lg group-hover:bg-black/50 transition-all">waiter / pass</span>

                                </div>

                                <div 
                                    onClick={() => { setUsername('chef'); setPassword('pass1'); }}
                                    className="flex justify-between items-center bg-white/15 p-3 rounded-xl border border-white/20 backdrop-blur-sm cursor-pointer hover:bg-white/25 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 group"
                                >

                                    <span className="font-semibold text-white/90 text-sm">👤 Chef:</span>

                                    <span className="text-orange-300 font-mono text-sm font-bold bg-black/30 px-3 py-1 rounded-lg group-hover:bg-black/50 transition-all">chef / pass1</span>

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

