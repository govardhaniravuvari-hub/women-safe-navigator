import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Logo from '../components/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blush-50 px-4 text-center">
      <Logo size={46} />
      <Compass size={36} className="mt-8 text-brand-400" />
      <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        The page you were looking for does not exist. If you followed a sharing link, it may have
        expired.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn-primary">Back to home</Link>
        <Link to="/dashboard" className="btn-secondary">Go to dashboard</Link>
      </div>
    </div>
  );
}
