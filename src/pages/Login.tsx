import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Mail, Lock, QrCode, Sparkles, LogIn, UserPlus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '@/components/AnimatedBackground';
import FloatingParticles from '@/components/FloatingParticles';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    resetEmail: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const { login, signup, resetPassword, loginWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!isLogin && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      console.log('Attempting auth with:', isLogin ? 'login' : 'signup', formData.email);
      
      if (isLogin) {
        await login(formData.email, formData.password);
        toast({
          title: "Login Successful",
          description: "Welcome back to HAG's QR Scanner!"
        });
      } else {
        await signup(formData.email, formData.password);
        toast({
          title: "Account Created",
          description: "Welcome to HAG's QR Scanner!"
        });
      }
      navigate('/');
    } catch (error: any) {
      console.error('Authentication error:', error);
      let errorMessage = 'An error occurred. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/invalid-api-key') {
        errorMessage = 'Firebase configuration error. Please contact support.';
      } else if (error.code === 'auth/project-not-found') {
        errorMessage = 'Firebase project not found. Please contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.log('Auth error code:', error.code);
      console.log('Auth error message:', error.message);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Starting Google login...');
      await loginWithGoogle();
      toast({
        title: "Login Successful",
        description: "Welcome to HAG's QR Scanner!"
      });
      navigate('/');
    } catch (error: any) {
      console.error('Google login error details:', error);
      let errorMessage = 'Failed to login with Google';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Google login was cancelled.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups and try again.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized for Google login. Please contact support.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google login is not enabled. Please contact support.';
      } else if (error.message) {
        errorMessage = `Google login failed: ${error.message}`;
      }
      
      setError(errorMessage);
      console.log('Displayed error:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.resetEmail) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      await resetPassword(formData.resetEmail);
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for password reset instructions"
      });
      setShowForgotPassword(false);
      setFormData(prev => ({ ...prev, resetEmail: '' }));
    } catch (error: any) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to send password reset email';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setShowForgotPassword(false);
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      resetEmail: ''
    });
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <AnimatedBackground />
        <FloatingParticles />

        <div className="container mx-auto px-4 py-8 relative z-10 flex items-center justify-center min-h-screen">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-8 slide-in-top">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl glow-effect">
                  <QrCode className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold gradient-text">Reset Password</h1>
              </div>
              <p className="text-lg text-gray-100">
                Enter your email to receive reset instructions
              </p>
            </div>

            {/* Reset Password Card */}
            <Card className="modern-card hover-lift slide-in-left">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl gradient-text">Forgot Password</CardTitle>
                <CardDescription className="text-base">
                  We'll send you a link to reset your password
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                {error && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handlePasswordReset} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail" className="text-sm font-medium">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="resetEmail"
                        name="resetEmail"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.resetEmail}
                        onChange={handleInputChange}
                        className="pl-10 h-12 bg-white/80 backdrop-blur-sm border-white/20 focus:border-purple-500 transition-all duration-300"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 text-lg font-medium bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 neon-button"
                  >
                    {loading ? (
                      <div className="loading-spinner" />
                    ) : (
                      <>
                        <Mail className="h-5 w-5 mr-2" />
                        Send Reset Email
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="font-medium text-purple-600 hover:text-purple-800 transition-colors duration-300"
                  >
                    Back to Login
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />
      <FloatingParticles />

      <div className="container mx-auto px-4 py-8 relative z-10 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8 slide-in-top">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl glow-effect">
                <QrCode className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold gradient-text">HAG's QR Scanner</h1>
              <Sparkles className="h-6 w-6 text-yellow-500 float-animation" />
            </div>
            <p className="text-lg text-gray-100">
              {isLogin ? 'Welcome back!' : 'Join us today!'}
            </p>
          </div>

          {/* Login/Register Card */}
          <Card className="modern-card hover-lift slide-in-left">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl gradient-text flex items-center justify-center gap-2">
                {isLogin ? (
                  <>
                    <LogIn className="h-6 w-6" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="h-6 w-6" />
                    Create Account
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-base">
                {isLogin 
                  ? 'Enter your credentials to access your account' 
                  : 'Create a new account to get started'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6">
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Google Login Button */}
              <Button
                onClick={handleGoogleLogin}
                disabled={loading}
                variant="outline"
                className="w-full h-12 mb-6 text-lg font-medium border-2 border-gray-300 hover:border-purple-500 transition-all duration-300 bg-white hover:bg-gray-50"
              >
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </div>
              </Button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="pl-10 h-12 bg-white/80 backdrop-blur-sm border-white/20 focus:border-purple-500 transition-all duration-300"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password {!isLogin && <span className="text-gray-500">(min. 6 characters)</span>}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="pl-10 pr-10 h-12 bg-white/80 backdrop-blur-sm border-white/20 focus:border-purple-500 transition-all duration-300"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field (only for register) */}
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="pl-10 h-12 bg-white/80 backdrop-blur-sm border-white/20 focus:border-purple-500 transition-all duration-300"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-lg font-medium bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 neon-button"
                >
                  {loading ? (
                    <div className="loading-spinner" />
                  ) : (
                    <>
                      {isLogin ? (
                        <>
                          <LogIn className="h-5 w-5 mr-2" />
                          Sign In
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-5 w-5 mr-2" />
                          Create Account
                        </>
                      )}
                    </>
                  )}
                </Button>

                {/* Forgot Password (only for login) */}
                {isLogin && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-purple-600 hover:text-purple-800 transition-colors duration-300"
                    >
                      Forgot your password?
                    </button>
                  </div>
                )}
              </form>

              {/* Toggle Auth Mode */}
              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-600">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                  <button
                    type="button"
                    onClick={toggleAuthMode}
                    className="ml-2 font-medium text-purple-600 hover:text-purple-800 transition-colors duration-300"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login; 