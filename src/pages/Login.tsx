import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useUser } from '../contexts/UserContext';

export default function Login() {
  const { setUser } = useUser();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setError(null);
      
      const response = await fetch('https://huduku.asianetnews.com/api/v1/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          token: credentialResponse.credential
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Authentication failed');
      }

      const data = await response.json();

      if (!data.access_token || !data.user) {
        throw new Error('Invalid response from server');
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setUser(data.user);
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    }
  };
  
  return (
    <div className="flex-1 flex items-center justify-center bg-[#1A1D21] p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white text-center mb-2">
          Welcome to Huduku AI
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Your Intelligent News Companion
        </p>

        {error && (
          <div className="bg-red-500 text-white p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setError('Google sign-in failed. Please try again.');
              }}
              useOneTap
              auto_select={false}
              theme="filled_black"
              text="continue_with"
              shape="rectangular"
              width="300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}