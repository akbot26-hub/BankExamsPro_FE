import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { FormField, Button } from '../components/ui.jsx';

const identitySchema = yup.object({ identifier: yup.string().trim().required('Enter your email or mobile number').test('contact', 'Enter a valid email or 10 digit mobile number', (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[+\d][\d\s()-]{8,15}$/.test(value)), name: yup.string().when('$needsName', { is: true, then: (schema) => schema.trim().required('Enter your full name') }) });
const codeSchema = yup.object({ code: yup.string().matches(/^\d{6}$/, 'Enter the 6 digit code').required('Enter the 6 digit code') });

export default function Login() {
  const { user, signInWithOtp, enterPreview } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('identify');       // identify → verify
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef(null);
  const identityForm = useForm({ resolver: yupResolver(identitySchema), context: { needsName }, defaultValues: { identifier: '', name: '' }, mode: 'onTouched' });
  const codeForm = useForm({ resolver: yupResolver(codeSchema), defaultValues: { code: '' }, mode: 'onTouched' });

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => { if (step === 'verify') codeRef.current?.focus(); }, [step]);

  if (user) return <Navigate to="/" replace />;

  async function requestOtp(values) {
    setBusy(true); setError('');
    try {
      const d = await api('/auth/request-otp', {
        method: 'POST',
        body: { identifier: values.identifier, ...(needsName ? { name: values.name } : {}) },
      });
      setIdentifier(values.identifier);
      if (values.name) setName(values.name);
      setSentTo(d.to);
      setDevOtp(d.devOtp || '');
      setCooldown(45);
      setStep('verify');
      codeForm.reset();
      toast.success('One-time code sent');
    } catch (err) {
      if (err.data?.needsRegistration) {
        setNeedsName(true);
        setError(name ? err.message : '');
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function verify(values) {
    setBusy(true); setError('');
    try {
      await signInWithOtp(identifier, values.code);
      toast.success('Signed in successfully');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loginDemo(demoIdentifier) {
    setBusy(true);
    setError('');
    try {
      // Create the pending OTP first so this uses the same server auth flow.
      await api('/auth/request-otp', { method: 'POST', body: { identifier: demoIdentifier } });
      await signInWithOtp(demoIdentifier, '123456');
      toast.success('Signed in successfully');
      navigate('/');
    } catch (err) {
      if (import.meta.env.DEV) {
        enterPreview();
        navigate('/');
      } else {
        setError(err.message || 'Could not sign in.');
      }
    } finally {
      setBusy(false);
    }
  }

  function submitIdentity(event) {
    const value = identityForm.getValues('identifier')?.trim();
    if (import.meta.env.DEV && !value) {
      event.preventDefault();
      loginDemo('arjun@student.in');
      return;
    }
    identityForm.handleSubmit(requestOtp)(event);
  }

  return (
    <div className="login-page">
      <section className="login-pitch">
        <div className="eyebrow" style={{ color: '#8fa0b5' }}>IBPS · SBI · RBI · RRB · LIC</div>
        <h1>Ten mocks. <em>One verdict.</em></h1>
        <p>
          Practise on a screen built to match the official examination portal, then let the
          analysis read all ten attempts together — where you are gaining, where you are
          bleeding marks, and what to revise tonight.
        </p>
        <p style={{ fontSize: 13, color: '#8fa0b5' }}>
          Study your analysis anywhere, including this phone. Attempting a paper needs a
          laptop or desktop — the same screen you will face on exam day.
        </p>
        <div className="proof">
          <div><b>100</b><span>questions per paper</span></div>
          <div><b>20:20:20</b><span>sectional timing</span></div>
          <div><b>−0.25</b><span>negative marking</span></div>
        </div>
      </section>

      <section className="login-form">
        <div className="inner">
          {step === 'identify' ? (
            <>
              <h2>Sign in with OTP</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Enter your email or mobile number and we will send a one-time code.
                No passwords on this platform.
              </p>
              {error && <div className="notice error">{error}</div>}
              <form onSubmit={submitIdentity} style={{ marginTop: 16 }} noValidate>
                <FormField id="identifier" label="Email or mobile number" placeholder="you@example.com or 98765 43210" autoComplete="username" inputMode="email" {...identityForm.register('identifier', { onChange: (e) => { setIdentifier(e.target.value); setNeedsName(false); } })} error={identityForm.formState.errors.identifier?.message} />
                {needsName && (
                  <FormField id="name" label="Your full name (new account)" placeholder="As it should appear on your admit card" autoComplete="name" {...identityForm.register('name')} error={identityForm.formState.errors.name?.message} />
                )}
                <Button type="submit" variant="primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
                  {busy ? 'Opening…' : !identifier.trim() && import.meta.env.DEV ? 'Open app preview' : needsName ? 'Register and send OTP' : 'Send OTP'}
                </Button>
              </form>
              <div className="hint">
                <b>Demo login</b> (local development only)<br />
                <div className="demo-login-actions">
                  <Button disabled={busy} onClick={() => loginDemo('arjun@student.in')}>Login as Student</Button>
                  <Button disabled={busy} onClick={() => loginDemo('admin@bankexamspro.in')}>Login as Admin</Button>
                </div>
                <span>Or enter <code>arjun@student.in</code> and use OTP <code>123456</code>.</span>
              </div>
            </>
          ) : (
            <>
              <h2>Enter the code</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                We sent a 6-digit code to <b>{sentTo}</b>. It is valid for 5 minutes.
              </p>
              {devOtp && (
                <div className="hint" style={{ marginTop: 12 }}>
                  <b>Dev delivery.</b> No SMS gateway is connected, so here is your code:{' '}
                  <code style={{ fontSize: 16, letterSpacing: 3 }}>{devOtp}</code>
                </div>
              )}
              {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}
              <form onSubmit={codeForm.handleSubmit(verify)} style={{ marginTop: 14 }} noValidate>
                <FormField id="code" label="One-time code" inputRef={codeRef} inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits" style={{ fontSize: 20, letterSpacing: 8, textAlign: 'center', fontFamily: 'var(--data)' }} {...codeForm.register('code', { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(e.target.value); } })} error={codeForm.formState.errors.code?.message} />
                <Button type="submit" variant="primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy || code.length !== 6}>
                  {busy ? 'Checking…' : 'Verify and sign in'}
                </Button>
              </form>
              <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
                {cooldown > 0
                  ? `You can request a new code in ${cooldown}s.`
                  : <a href="#" onClick={(e) => { e.preventDefault(); identityForm.handleSubmit(requestOtp)(); }}>Send a new code</a>}
                {' · '}
                <a href="#" onClick={(e) => { e.preventDefault(); setStep('identify'); setError(''); }}>Change email or number</a>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
