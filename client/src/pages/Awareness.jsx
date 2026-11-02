import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  Moon,
  PhoneCall,
  Route,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Bus,
  ClipboardCheck,
  Flag,
  Siren,
} from 'lucide-react';
import { Alert, EmptyState, Spinner } from '../components/ui';
import { get } from '../lib/api';

const ICONS = {
  'clipboard-check': ClipboardCheck,
  moon: Moon,
  smartphone: Smartphone,
  siren: Siren,
  radio: Route,
  route: Route,
  bus: Bus,
  flag: Flag,
};

const CATEGORY_LABEL = {
  travel: 'Travel',
  night: 'Night travel',
  digital: 'Digital safety',
  emergency: 'Emergency',
  navigation: 'Navigation',
  helplines: 'Helplines',
  general: 'General',
};

export default function Awareness() {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [helplines, setHelplines] = useState([]);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    get('/awareness')
      .then((d) => setContent(d.content))
      .catch(() => setContent([]))
      .finally(() => setLoading(false));
    get('/services/helplines')
      .then((d) => {
        setHelplines(d.helplines);
        setResources(d.resources || []);
      })
      .catch(() => {});
  }, []);

  const categories = useMemo(() => {
    const set = new Set(content.map((item) => item.category));
    return ['all', ...set];
  }, [content]);

  const filtered = category === 'all' ? content : content.filter((item) => item.category === category);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Women&apos;s safety awareness</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Know what to do before you need to</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Short, practical guides on safe travel, night journeys, digital privacy and emergency
          response, with official resources at the end.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize transition ${
              category === key
                ? 'border-brand-500 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
            }`}
          >
            {key === 'all' ? 'All guides' : CATEGORY_LABEL[key] || key}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {loading ? (
            <div className="card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
              <Spinner /> Loading guides…
            </div>
          ) : filtered.length ? (
            filtered.map((guide) => {
              const Icon = ICONS[guide.icon] || BookOpen;
              const open = openId === guide.id;
              return (
                <article key={guide.id} className="card overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 p-4 text-left"
                    onClick={() => setOpenId(open ? null : guide.id)}
                    aria-expanded={open}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{guide.title}</span>
                        <span className="badge bg-blush-50 text-blush-600">{CATEGORY_LABEL[guide.category] || guide.category}</span>
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-slate-600">{guide.summary}</span>
                    </span>
                    <ChevronDown
                      size={17}
                      className={`mt-1 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {open ? (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
                      <ul className="space-y-2">
                        {guide.body.split('\n').filter(Boolean).map((line) => (
                          <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-slate-700">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                            <span>{line.replace(/^[-•]\s*/, '')}</span>
                          </li>
                        ))}
                      </ul>
                      {guide.source ? (
                        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500">
                          <Sparkles size={12} className="mt-0.5 shrink-0" /> Source: {guide.source}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No guides in this category"
              description="Try another category or check back later."
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <PhoneCall size={16} className="text-rose-500" /> Helplines
            </h2>
            <ul className="mt-2 space-y-2">
              {helplines.map((line) => (
                <li key={line.number}>
                  <a
                    href={`tel:${line.number}`}
                    className="block rounded-xl border border-slate-200 px-3 py-2 transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-brand-700">{line.number}</span>
                      <span className="text-[10px] text-slate-400">{line.available}</span>
                    </span>
                    <span className="block text-[11px] font-medium text-slate-700">{line.name}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{line.description}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck size={16} className="text-brand-600" /> Official resources
            </h2>
            <ul className="mt-2 space-y-2">
              {resources.map((resource) => (
                <li key={resource.url}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                  >
                    {resource.name} <ExternalLink size={12} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <Alert tone="warning" title="This is guidance, not legal advice">
            Laws and helpline availability change by state. For legal support, contact the National
            Commission for Women or a local One Stop Centre.
          </Alert>
        </div>
      </div>
    </div>
  );
}
