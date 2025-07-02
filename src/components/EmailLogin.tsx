'use client';
import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface EmailLoginProps {
  onSuccess?: () => void;
  className?: string;
}

export default function EmailLogin({
  onSuccess,
  className = '',
}: EmailLoginProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const { ready, authenticated } = usePrivy();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();

  // Redirect if already authenticated
  useEffect(() => {
    if (authenticated && onSuccess) {
      onSuccess();
    }
  }, [authenticated, onSuccess]);

  // Handle resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendCode = useCallback(async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      await sendCode({ email });
      setStep('code');
      setResendTimer(60); // 60 second cooldown
      toast.success('Check your email for the verification code');
    } catch (error) {
      console.error('Failed to send code:', error);
      toast.error('Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, sendCode]);

  const handleLogin = useCallback(async () => {
    if (!code || code.length < 6) {
      toast.error('Please enter the 6-digit code from your email');
      return;
    }

    setIsLoading(true);
    try {
      await loginWithCode({ code });
      toast.success('Successfully logged in!');
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Invalid code. Please try again.');
      setCode('');
    } finally {
      setIsLoading(false);
    }
  }, [code, loginWithCode, onSuccess]);

  const handleResendCode = useCallback(async () => {
    if (resendTimer > 0) return;

    setIsLoading(true);
    try {
      await sendCode({ email });
      setResendTimer(60);
      toast.success('New code sent to your email');
    } catch (error) {
      console.error('Failed to resend code:', error);
      toast.error('Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, sendCode, resendTimer]);

  if (!ready) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (authenticated) {
    return null;
  }

  return (
    <div className={`w-full max-w-sm mx-auto ${className}`}>
      {step === 'email' ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Get Started</h2>
            <p className="text-gray-400 text-sm">
              Enter your email to create or access your account
            </p>
          </div>

          <div>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendCode()}
              className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              disabled={isLoading}
              autoFocus={true}
            />
          </div>

          <button
            onClick={handleSendCode}
            disabled={isLoading || !email}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Sending...
              </span>
            ) : (
              'Continue with Email'
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-black px-2 text-gray-500">Or</span>
            </div>
          </div>

          <button
            onClick={() => (window.location.href = '/')}
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-all"
          >
            Connect Wallet Instead
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Check your email
            </h2>
            <p className="text-gray-400 text-sm">
              We sent a 6-digit code to {email}
            </p>
          </div>

          <div>
            <input
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
              }}
              onKeyPress={(e) =>
                e.key === 'Enter' && code.length === 6 && handleLogin()
              }
              className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors text-center text-2xl font-mono tracking-wider"
              disabled={isLoading}
              autoFocus={true}
              maxLength={6}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Enter the 6-digit code from your email
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading || code.length !== 6}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Verifying...
              </span>
            ) : (
              'Verify & Continue'
            )}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => {
                setStep('email');
                setCode('');
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Change email
            </button>

            <button
              onClick={handleResendCode}
              disabled={resendTimer > 0}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
