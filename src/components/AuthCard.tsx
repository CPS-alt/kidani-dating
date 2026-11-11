import { useState } from 'react';
import type { AuthMode } from '../types';

interface AuthCardProps {
  authMode: AuthMode;
  authForm: {
    name: string;
    email: string;
    password: string;
    location: string;
    age: string;
    phoneNumber: string;
  };
  accountType: 'woman' | 'man' | 'gay';
  onAccountTypeChange: (accountType: 'woman' | 'man' | 'gay') => void;
  onChange: (field: keyof AuthCardProps['authForm'], value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggleMode: () => void;
}

export function AuthCard({ authMode, authForm, accountType, onAccountTypeChange, onChange, onSubmit, onToggleMode }: AuthCardProps) {
  const isSignup = authMode === 'signup';
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section id="access" className="auth-card">
      <div className="auth-mode-tabs" role="tablist" aria-label="Account access">
        <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? 'active' : ''} onClick={() => { if (isSignup) onToggleMode(); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? 'active' : ''} onClick={() => { if (!isSignup) onToggleMode(); }}>Create account</button>
      </div>
      <div className="auth-header">
        <div>
          <p className="eyebrow">{isSignup ? 'JOIN THE COMMUNITY' : 'WELCOME BACK'}</p>
          <h2>{isSignup ? 'Create your account' : 'Sign in to Kidani'}</h2>
        </div>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        {isSignup ? (
          <label>
            Your name
            <input
              type="text"
              value={authForm.name}
              onChange={(event) => onChange('name', event.target.value)}
              placeholder="What should we call you?"
              autoComplete="name"
              maxLength={80}
              required
            />
          </label>
        ) : null}

        <label>
          Email address
          <input
            type="email"
            value={authForm.email}
            onChange={(event) => onChange('email', event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <span className="password-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              aria-label="Password"
              value={authForm.password}
              onChange={(event) => onChange('password', event.target.value)}
              placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={isSignup ? 8 : undefined}
              maxLength={72}
              required
            />
            <button type="button" className="password-visibility-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                {showPassword
                  ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.5 0 9 7 9 7a15.7 15.7 0 0 1-3.1 3.8" /><path d="M6.2 6.2C3.9 7.7 3 12 3 12s3.5 7 9 7a10.5 10.5 0 0 0 4-.8" /></>
                  : <><path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.7" /></>}
              </svg>
            </button>
          </span>
        </label>

        {isSignup ? (
          <>
            <label>
              M-Pesa phone number
              <input
                type="tel"
                value={authForm.phoneNumber}
                onChange={(event) => onChange('phoneNumber', event.target.value)}
                placeholder="e.g. 07xx xxx xxx"
                autoComplete="tel"
                inputMode="tel"
                required
              />
            </label>
            <div className="auth-form-row">
              <label>
                Age
                <input
                  type="number"
                  value={authForm.age}
                  onChange={(event) => onChange('age', event.target.value)}
                  placeholder="18 or older"
                  min="18"
                  max="120"
                  required
                />
              </label>
              <label>
                City / location
                <input
                  type="text"
                  value={authForm.location}
                  onChange={(event) => onChange('location', event.target.value)}
                  placeholder="Your city"
                  autoComplete="address-level2"
                  maxLength={100}
                  required
                />
              </label>
            </div>
            <div className="auth-account-type">
              <span>Choose your profile</span>
              <div className="segmented-control" role="group" aria-label="Gender">
                {(['woman', 'man', 'gay'] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    className={accountType === type ? 'active' : ''}
                    aria-pressed={accountType === type}
                    onClick={() => onAccountTypeChange(type)}
                  >
                    {type === 'woman' ? 'Woman' : type === 'man' ? 'Man' : 'Gay'}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <button type="submit" className="primary-btn">
          {isSignup ? 'Create my account' : 'Sign in'}
        </button>
      </form>
      {isSignup ? <p className="auth-form-hint">By continuing, you confirm that you are 18 or older and agree to treat the Kidani community with care.</p> : null}
    </section>
  );
}
