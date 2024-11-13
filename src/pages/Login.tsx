import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Apple } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export default function Login() {
  const { setUser } = useUser();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      console.log('Google response:', credentialResponse);
      
      const response = await fetch('https://35.207.211.198.nip.io/api/v1/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: credentialResponse.credential
        }),
      });
  
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Response text:', responseText);
  
      if (!responseText) {
        throw new Error('Empty response from server');
      }
  
      const data = JSON.parse(responseText);
      
      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }
  
      localStorage.setItem('token', data.access_token);
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
          Welcome to Asianxt Search
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Sign in or sign up to continue
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
                console.log('Login Failed');
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
