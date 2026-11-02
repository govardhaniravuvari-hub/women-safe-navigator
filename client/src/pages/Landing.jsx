import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  BookOpen,
  CheckCircle2,
  Flag,
  Hospital,
  MapPin,
  Menu,
  Navigation,
  PhoneCall,
  Radio,
  ShieldCheck,
  ShieldPlus,
  Siren,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import Logo, { LogoMark } from '../components/Logo';
import { get } from '../lib/api';
import { formatDistance } from '../lib/format';

const FEATURES = [
  {
    icon: Navigation,
    title: 'Safer route planning',
    text: 'Compare walking routes with a transparent confidence estimate built from verified reports, mapped street lighting and public activity.',
  },
  {
    icon: Radio,
    title: 'Live location sharing',
    text: 'Share a private, expiring link with one trusted person so they can follow your journey — and stop it the moment you arrive.',
  },
  {
    icon: Siren,
    title: 'One-tap SOS',
    text: 'Log an emergency, alert your trusted contacts and get your exact location plus a Google Maps link in seconds.',
  },
  {
    icon: Hospital,
    title: 'Nearby emergency help',
    text: 'Find police stations, hospitals and ambulances around you on a live map from OpenStreetMap data.',
  },
  {
    icon: Flag,
    title: 'Community reporting',
    text: 'Report harassment, dark roads and unsafe spots. Moderators verify every report before it becomes a public alert.',
  },
  {
    icon: BellRing,
    title: 'Verified safety alerts',
    text: 'Get notified when a report near you is verified, plus official announcements from the SAFEPATH team.',
  },
  {
    icon: Users,
    title: 'Trusted contacts',
    text: 'Save up to ten contacts with relationships and one primary contact for emergencies, with instant calling.',
  },
  {
    icon: BookOpen,
    title: 'Safety awareness',
    text: 'Practical guidance for night travel, public transport, digital privacy and responding to an emergency.',
  },
];

const WHY = [
  {
    title: 'Honest by design',
    text: 'We never label a route "safe". Scores are explained, missing data lowers confidence, and alerts tell you exactly what was delivered.',
  },
  {
    title: 'Privacy first',
    text: 'Reports are anonymised on the public map. Live links are unlisted, expiring and revocable. Location history stays yours.',
  },
  {
    title: 'Built for Indian streets',
    text: 'Hindi-friendly helplines, 112, 181, 1091 and local police numbers alongside real OpenStreetMap data.',
  },
  {
    title: 'Moderated, not automatic',
    text: 'A human moderator checks every community report, so the map does not fill up with noise or false alarms.',
  },
];

function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -top-6 -left-4 size-24 rounded-full bg-blush-200/60 blur-2xl" />
      <div className="absolute -right-6 bottom-8 size-32 rounded-full bg-brand-300/40 blur-2xl" />

      <div className="relative animate-float rounded-[28px] border border-white/60 bg-white/95 p-4 shadow-[0_30px_70px_-30px_rgba(76,29,149,0.55)]">
        <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2">
          <span className="flex items-center gap-2 text-xs font-semibold text-brand-800">
            <Navigation size={13} /> MG Road → Koramangala
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            82/100
          </span>
        </div>

        <div className="relative mt-3 h-44 overflow-hidden rounded-xl bg-[#eef2f7]">
          <svg viewBox="0 0 320 180" className="absolute inset-0 size-full" aria-hidden="true">
            <defs>
              <linearGradient id="hero-route" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#EE4F9F" />
              </linearGradient>
            </defs>
            <g stroke="#dfe6ef" strokeWidth="10">
              <path d="M-10 40 H330" />
              <path d="M-10 118 H330" />
              <path d="M70 -10 V190" />
              <path d="M220 -10 V190" />
            </g>
            <g fill="#e7ecf5">
              <rect x="88" y="52" width="42" height="30" rx="4" />
              <rect x="140" y="52" width="58" height="30" rx="4" />
              <rect x="88" y="132" width="60" height="32" rx="4" />
              <rect x="240" y="132" width="52" height="32" rx="4" />
              <rect x="240" y="52" width="40" height="30" rx="4" />
            </g>
            <path
              d="M40 160 C 80 120, 120 130, 150 96 S 210 52, 272 28"
              fill="none"
              stroke="url(#hero-route)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="1 0"
            />
            <circle cx="40" cy="160" r="7" fill="#7C3AED" stroke="white" strokeWidth="3" />
            <circle cx="272" cy="28" r="7" fill="#EE4F9F" stroke="white" strokeWidth="3" />
            <circle cx="150" cy="96" r="5" fill="#E11D48" stroke="white" strokeWidth="2" />
          </svg>
          <div className="absolute top-2 right-2 rounded-lg bg-white/95 px-2 py-1 text-[9px] font-semibold text-rose-600 shadow-sm">
            ⚠ 1 verified alert nearby
          </div>
          <div className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-2 py-1 text-[9px] font-semibold text-blue-700 shadow-sm">
            🚔 3 police · 🏥 4 hospitals
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['Lighting', 'Good'],
            ['Activity', 'Busy'],
            ['Reports', 'None on route'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-100 px-1.5 py-1.5">
              <p className="text-[9px] tracking-wide text-slate-400 uppercase">{label}</p>
              <p className="text-[11px] font-semibold text-slate-700">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-rose-600 px-3 py-2.5 text-white">
          <span className="flex items-center gap-2 text-xs font-bold tracking-wide">
            <ShieldPlus size={15} /> SOS EMERGENCY
          </span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">Tap & hold</span>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-5 flex items-center gap-2 rounded-xl border border-brand-100 bg-white px-3 py-2 shadow-lg">
        <span className="grid size-7 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={14} />
        </span>
        <div>
          <p className="text-[10px] font-semibold text-slate-500">Live sharing</p>
          <p className="text-[11px] font-bold text-slate-800">Mom is following</p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [menu, setMenu] = useState(false);
  const [stats, setStats] = useState(null);
  const [helplines, setHelplines] = useState([]);
  const [resources, setResources] = useState([]);
  const [guides, setGuides] = useState([]);

  useEffect(() => {
    get('/public/stats').then(setStats).catch(() => {});
    get('/services/helplines')
      .then((d) => {
        setHelplines(d.helplines.slice(0, 4));
        setResources(d.resources || []);
      })
      .catch(() => {});
    get('/awareness')
      .then((d) => setGuides(d.content.slice(0, 3)))
      .catch(() => {});
  }, []);

  const links = [
    ['Home', '#home'],
    ['Features', '#features'],
    ['About Us', '#about'],
    ['Safety Tips', '#safety-tips'],
    ['Contact', '#contact'],
  ];

  return (
    <div id="home" className="min-h-screen scroll-smooth bg-white">
      <header className="sticky top-0 z-40 border-b border-brand-100/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
          <Logo size={40} />
          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Link to="/login" className="btn-ghost">
              Login
            </Link>
            <Link to="/register" className="btn-primary">
              Sign Up <ArrowRight size={15} />
            </Link>
          </div>
          <button
            type="button"
            className="ml-auto rounded-xl border border-slate-200 p-2 text-slate-600 sm:hidden"
            onClick={() => setMenu((v) => !v)}
            aria-label="Toggle navigation"
          >
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {menu ? (
          <div className="border-t border-brand-100 bg-white px-4 py-3 sm:hidden">
            <div className="flex flex-col gap-1">
              {links.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenu(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50"
                >
                  {label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to="/login" className="btn-secondary">
                  Login
                </Link>
                <Link to="/register" className="btn-primary">
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-r from-brand-100/60 via-blush-100/50 to-brand-50/40 blur-2xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-20">
          <div className="animate-fade-up">
            <span className="badge bg-white text-brand-700 ring-1 ring-brand-200">
              <Sparkles size={12} /> Community Service Project
            </span>
            <h1 className="mt-4 text-4xl leading-[1.08] font-extrabold text-slate-900 sm:text-5xl lg:text-6xl">
              Travel Smart.
              <br />
              Stay Safe.
              <br />
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-blush-500 bg-clip-text text-transparent">
                Every Journey Matters.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
              SAFEPATH is a women&apos;s safety navigator that helps you plan journeys with
              confidence estimates, see nearby police and hospitals, share your live location with a
              trusted person, and raise an SOS in one tap. Your safety. Your journey. Your confidence.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/register" className="btn-primary px-5 py-3 text-base">
                Get Started <ArrowRight size={17} />
              </Link>
              <a href="#features" className="btn-secondary px-5 py-3 text-base">
                <ShieldCheck size={17} /> Explore Safety Features
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" /> No API key needed to try it
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" /> OpenStreetMap powered
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" /> Built on MySQL + REST APIs
              </span>
            </div>
          </div>
          <HeroIllustration />
        </div>
      </section>

      {/* LIVE NUMBERS */}
      <section className="border-y border-brand-100 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4 lg:px-8">
          {[
            ['Registered users', stats ? stats.users : '—'],
            ['Verified alerts', stats ? stats.verifiedReports : '—'],
            ['Reports in review', stats ? stats.pendingReports : '—'],
            ['Cities represented', stats ? stats.cities : '—'],
          ].map(([label, value]) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-extrabold text-brand-700">{value}</p>
              <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
            </div>
          ))}
        </div>
        <p className="pb-4 text-center text-[10px] text-slate-400">
          Counts are read live from the SAFEPATH database — nothing is simulated.
        </p>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-24 bg-[#fbf9ff] py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold tracking-[0.16em] text-brand-600 uppercase">
              Safety features
            </p>
            <h2 className="section-title mt-2">Everything you need, on one screen</h2>
            <p className="mt-3 text-slate-600">
              Eight connected tools — all backed by a real Node.js API and MySQL database, not
              mock-ups.
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="card group p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[var(--shadow-soft)]"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                  <feature.icon size={20} />
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-brand-600 uppercase">
              Why choose SafePath
            </p>
            <h2 className="section-title mt-2">Safety information you can actually trust</h2>
            <p className="mt-3 text-slate-600">
              Most safety apps promise a "safe route". SAFEPATH shows its working: what data was
              used, what was missing, and what to do next. That honesty is the feature.
            </p>
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">A note on route scores</p>
              <p className="mt-1 leading-relaxed">
                Confidence scores are estimates from community reports, OpenStreetMap lighting and
                activity data. They are not a guarantee of safety. Always trust your instincts, travel
                with someone when you can, and call <strong>112</strong> in an emergency.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {WHY.map((item, index) => (
              <div key={item.title} className="rounded-2xl border border-brand-100 bg-[#fbf9ff] p-5">
                <span className="grid size-8 place-items-center rounded-lg bg-white text-xs font-bold text-brand-700 shadow-sm">
                  0{index + 1}
                </span>
                <h3 className="mt-3 text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HELPLINES */}
      <section id="safety-tips" className="scroll-mt-24 bg-gradient-to-br from-brand-700 via-brand-600 to-plum-500 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-white/70 uppercase">
                Emergency helplines
              </p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Save these numbers before you need them</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Official Indian helplines. Availability can vary by state; 112 works everywhere in
                India, 24x7.
              </p>
            </div>
            <Link to="/register" className="btn bg-white text-brand-700 hover:bg-brand-50">
              Create your safety profile <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {helplines.map((line) => (
              <a
                key={line.number}
                href={`tel:${line.number}`}
                className="group rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur transition hover:border-white/40 hover:bg-white/15"
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl font-extrabold">{line.number}</span>
                  <PhoneCall size={16} className="text-white/70 transition group-hover:text-white" />
                </div>
                <p className="mt-1 text-sm font-semibold">{line.name}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/70">{line.description}</p>
              </a>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/75">
            <span>Verified resources:</span>
            {resources.map((r) => (
              <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="underline hover:text-white">
                {r.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* GUIDES PREVIEW */}
      <section className="bg-[#fbf9ff] py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-brand-600 uppercase">
                Women&apos;s safety awareness
              </p>
              <h2 className="section-title mt-2">Learn the basics before the journey</h2>
            </div>
            <Link to="/awareness" className="btn-secondary">
              <BookOpen size={16} /> All safety guides
            </Link>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {guides.length
              ? guides.map((guide) => (
                  <article key={guide.id} className="card p-5">
                    <span className="badge bg-blush-50 text-blush-600 capitalize">{guide.category}</span>
                    <h3 className="mt-3 font-bold text-slate-900">{guide.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-600">{guide.summary}</p>
                    <Link
                      to="/awareness"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
                    >
                      Read guide <ArrowRight size={13} />
                    </Link>
                  </article>
                ))
              : [1, 2, 3].map((n) => (
                  <div key={n} className="card h-40 animate-pulse bg-slate-50 p-5" aria-hidden="true" />
                ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="scroll-mt-24 bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-brand-600 uppercase">About us</p>
            <h2 className="section-title mt-2">A student-built platform for real journeys</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
              <p>
                SAFEPATH was built as a Community Service Project to address a problem every woman
                recognises: the uncertainty of travelling alone, especially after dark. Instead of
                another panic-button app, we combined navigation, community reporting, verified
                moderation and honest safety estimates in one place.
              </p>
              <p>
                The platform runs on a React frontend, a Node.js + Express REST API and a MySQL
                database. Maps and street data come from OpenStreetMap, routing from public
                pedestrian routers, and every alert is logged so nothing is simulated.
              </p>
              <p className="font-medium text-slate-700">
                It is a demonstration project, not a replacement for the police or emergency
                services. Always call 112 in a real emergency.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [ShieldCheck, 'Moderated reports', 'Human verification before public display'],
              [MapPin, 'Open data', 'OpenStreetMap maps, POIs and street data'],
              [Users, 'Trusted circle', 'Primary contacts for SOS and sharing'],
              [PhoneCall, 'Official helplines', '112, 181, 1091, 1930 built in'],
            ].map(([Icon, title, text]) => (
              <div key={title} className="rounded-2xl border border-brand-100 bg-[#fbf9ff] p-4">
                <Icon size={18} className="text-brand-600" />
                <p className="mt-2 text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-1 text-xs text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="scroll-mt-24 bg-[#fbf9ff] py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-brand-100 bg-white p-6 shadow-[var(--shadow-card)] sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-brand-600 uppercase">Contact</p>
                <h2 className="section-title mt-2">Questions, feedback or a campus demo?</h2>
                <p className="mt-3 max-w-xl text-sm text-slate-600">
                  SAFEPATH is presented as a college Community Service Project. For feedback, a
                  demonstration request or to report a problem with the platform, reach out to the
                  project team.
                </p>
                <div className="mt-5 space-y-2 text-sm">
                  <a href="mailto:team@safepath.app" className="flex items-center gap-2 font-semibold text-brand-700">
                    <PhoneCall size={15} /> team@safepath.app
                  </a>
                  <p className="flex items-center gap-2 text-slate-600">
                    <MapPin size={15} /> Bengaluru, Karnataka, India
                  </p>
                  <p className="flex items-center gap-2 text-slate-600">
                    <Siren size={15} /> In an emergency always call 112 — this inbox is not monitored 24x7.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-plum-500 p-5 text-white">
                <ShieldCheck size={22} />
                <h3 className="mt-2 text-lg font-bold">Try the full platform</h3>
                <p className="mt-1 text-sm text-white/80">
                  Register with any email to explore the dashboard, route comparison, live sharing,
                  SOS and reporting. A demo account is listed on the login page.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link to="/register" className="btn bg-white text-brand-700 hover:bg-brand-50">
                    Create free account
                  </Link>
                  <Link to="/login" className="btn border border-white/40 text-white hover:bg-white/10">
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-brand-950 py-12 text-white/70">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark size={36} />
              <span className="text-lg font-extrabold text-white">
                SAFE<span className="text-blush-400">PATH</span>
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed">
              Your Safety. Your Journey. Your Confidence. A women&apos;s safety navigator built with
              React, Node.js, Express and MySQL.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold tracking-wide text-white uppercase">Platform</p>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link to="/register" className="hover:text-white">Create account</Link></li>
              <li><Link to="/login" className="hover:text-white">Sign in</Link></li>
              <li><Link to="/awareness" className="hover:text-white">Safety guides</Link></li>
              <li><Link to="/admin/login" className="hover:text-white">Administrator</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold tracking-wide text-white uppercase">Useful links</p>
            <ul className="mt-3 space-y-2 text-xs">
              <li><a href="https://112.gov.in/" target="_blank" rel="noreferrer" className="hover:text-white">ERSS 112</a></li>
              <li><a href="https://ncw.nic.in/" target="_blank" rel="noreferrer" className="hover:text-white">National Commission for Women</a></li>
              <li><a href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer" className="hover:text-white">Cyber crime reporting</a></li>
              <li><a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer" className="hover:text-white">OpenStreetMap</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold tracking-wide text-white uppercase">Emergency</p>
            <ul className="mt-3 space-y-2 text-xs">
              <li><a href="tel:112" className="hover:text-white">112 — All emergencies</a></li>
              <li><a href="tel:181" className="hover:text-white">181 — Women helpline</a></li>
              <li><a href="tel:100" className="hover:text-white">100 — Police</a></li>
              <li><a href="tel:108" className="hover:text-white">108 — Ambulance</a></li>
              <li><a href="tel:1930" className="hover:text-white">1930 — Cyber crime</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-white/10 px-4 pt-5 text-[11px] lg:px-8">
          <p>
            © {new Date().getFullYear()} SAFEPATH — Community Service Project. Route scores are
            estimates, not guarantees. Sample data on this deployment is clearly labelled.
          </p>
        </div>
      </footer>
    </div>
  );
}
