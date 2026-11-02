import { Link } from 'react-router-dom';
import { ArrowLeft, PhoneCall, ShieldCheck } from 'lucide-react';
import Logo from './Logo';

export default function AuthShell({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-blush-50">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-plum-500 p-10 text-white lg:flex">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="text-lg font-extrabold tracking-tight">
              SAFE<span className="text-blush-300">PATH</span>
            </span>
          </Link>

          <div>
            <ShieldCheck size={34} className="text-blush-200" />
            <h2 className="mt-4 text-3xl leading-tight font-extrabold">
              Your safety.
              <br />
              Your journey.
              <br />
              Your confidence.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
              Plan journeys with transparent confidence estimates, keep trusted contacts one tap
              away, and share your live location only with the people you choose.
            </p>
            <div className="mt-6 space-y-2 text-sm text-white/85">
              <p>• 112 national emergency number built in</p>
              <p>• Verified community reports, reviewed by moderators</p>
              <p>• Live sharing links expire and can be revoked</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <PhoneCall size={15} /> In an emergency, call 112
            </p>
            <p className="mt-1 text-xs text-white/70">
              SAFEPATH is a demonstration platform and does not dispatch emergency services.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Logo size={38} />
              <Link to="/" className="btn-ghost text-xs">
                <ArrowLeft size={14} /> Home
              </Link>
            </div>

            <div className={`rounded-3xl border border-brand-100 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8 ${wide ? 'max-w-none' : ''}`}>
              <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
              {subtitle ? <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p> : null}
              <div className="mt-6">{children}</div>
            </div>

            {footer ? <div className="mt-5 text-center text-sm text-slate-500">{footer}</div> : null}

            <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
              By continuing you agree to use SAFEPATH responsibly. Safety scores are estimates and
              never a guarantee. Call 112 in an emergency.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
