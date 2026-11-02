#!/usr/bin/env node
/**
 * Seeds SAFEPATH with:
 *  - the administrator account (from ADMIN_EMAIL / ADMIN_PASSWORD)
 *  - official helpline settings
 *  - women's safety awareness guides (sourced)
 *  - a clearly-labelled DEMO user + DEMO safety reports (is_sample = 1)
 *
 * Idempotent: re-running updates rather than duplicating.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, q, q1, insert } from '../server/db/pool.js';
import { config } from '../server/config.js';

const AWARENESS = [
  {
    slug: 'before-you-leave',
    title: 'Before you leave: a 2-minute safety check',
    category: 'travel',
    icon: 'clipboard-check',
    summary: 'Six quick checks that make any journey more predictable.',
    source: 'General guidance compiled from National Commission for Women and Delhi Police safety advisories.',
    body: [
      'Share your route and expected arrival time with one trusted person.',
      'Keep your phone charged above 30% and carry a power bank for long trips.',
      'Save 112 as a speed-dial contact and keep the emergency dialler one tap away.',
      'Prefer well-lit main roads over shortcuts, even if they take longer.',
      'Avoid displaying expensive jewellery, laptops or cash in isolated stretches.',
      'Fix your cab details and share the number plate and driver details with a contact.',
    ].join('\n'),
  },
  {
    slug: 'night-travel',
    title: 'Travelling at night',
    category: 'night',
    icon: 'moon',
    summary: 'Practical precautions for late journeys.',
    source: 'Based on public advisories from Delhi Police and state police awareness campaigns.',
    body: [
      'Book cabs from the app rather than taking unmarked vehicles; verify the number plate before boarding.',
      'Sit in the rear seat and keep the live-location sharing feature on until you reach your destination.',
      'Avoid wearing headphones with both ears covered, so you stay aware of your surroundings.',
      'If you feel someone is following you, enter an open shop or lit public place and call 112 or a trusted contact.',
      'Tell someone your ETA and message them when you reach safely.',
    ].join('\n'),
  },
  {
    slug: 'digital-safety',
    title: 'Digital safety and privacy',
    category: 'digital',
    icon: 'smartphone',
    summary: 'Protect your accounts, your location data and your photos.',
    source: 'National Cyber Crime Reporting Portal (cybercrime.gov.in) and general platform guidance.',
    body: [
      'Never share OTPs. No bank, police officer or delivery agent needs your OTP.',
      'Review app location permissions; set them to "while using the app" rather than "always".',
      'Turn off photo geotagging when posting publicly and avoid posting live locations.',
      'Report online harassment, morphed images or stalking to 1930 or cybercrime.gov.in and keep screenshots with dates.',
      'Use a strong unique password and enable two-factor authentication on email and social accounts.',
      'If someone threatens to share private images, report it immediately — this is a crime you can report anonymously.',
    ].join('\n'),
  },
  {
    slug: 'emergency-response',
    title: 'If something goes wrong: emergency response',
    category: 'emergency',
    icon: 'siren',
    summary: 'What to do in the first 60 seconds.',
    source: 'ERSS (112 India) guidance.',
    body: [
      'Call 112 for police, fire or ambulance. It is free and works across India, even from a locked phone keypad.',
      'State your location clearly — a landmark, metro station or shop name helps responders find you faster.',
      'Noise and attention are your allies: shout for help, bang on doors, run towards people and light.',
      'Use the SAFEPATH SOS button to alert your trusted contacts with your live location.',
      'After the incident, preserve evidence — screenshots, call records, CCTV location, witness names — and file an FIR at any police station.',
      'You can also approach the National Commission for Women (ncw.nic.in) or a local One Stop Centre for support.',
    ].join('\n'),
  },
  {
    slug: 'use-live-sharing',
    title: 'How to use live location sharing safely',
    category: 'navigation',
    icon: 'radio',
    summary: 'Share your journey without sharing it with the world.',
    source: 'SAFEPATH product guidance.',
    body: [
      'Start sharing only when you begin your journey, and choose the shortest window that covers your trip.',
      'Send the link to one or two trusted contacts only — not in public groups or social media.',
      'Keep the link tab open on your phone so location updates continue.',
      'Press "Stop sharing" as soon as you arrive. The link then shows that sharing has ended.',
      'Every sharing link is unique, unlisted and expires automatically — you can revoke it at any time.',
    ].join('\n'),
  },
  {
    slug: 'route-confidence',
    title: 'Reading a route confidence score',
    category: 'navigation',
    icon: 'route',
    summary: 'What SAFEPATH can and cannot tell you about a route.',
    source: 'SAFEPATH scoring model documentation.',
    body: [
      'The score is an estimate built from verified community reports, mapped street lamps and public-activity points around the route.',
      'A high score means fewer reported concerns near the route — it is not a guarantee of safety.',
      'A low score is a prompt to review the factors, choose another route or travel with someone.',
      'Data gaps reduce confidence: if OpenStreetMap lighting data is missing, the score says so instead of assuming the road is lit.',
      'Your own judgement, local knowledge and the time of day matter more than any score.',
    ].join('\n'),
  },
  {
    slug: 'public-transport',
    title: 'Public transport precautions',
    category: 'travel',
    icon: 'bus',
    summary: 'Buses, metro and autos — staying aware and in control.',
    source: 'General guidance from metro and city transport safety advisories.',
    body: [
      'Note the vehicle number and, for autos, the driver\'s badge before boarding.',
      'Sit near the driver or in a compartment with other passengers where possible.',
      'In the metro, wait in the ladies\' coach area marked on the platform; use the emergency intercom if needed.',
      'Trust your instinct: if a vehicle or compartment feels wrong, get off at the next safe stop.',
      'Avoid sleeping on long journeys; keep your belongings attached to you.',
    ].join('\n'),
  },
  {
    slug: 'reporting-incidents',
    title: 'Reporting an unsafe location on SAFEPATH',
    category: 'general',
    icon: 'flag',
    summary: 'Good reports help every woman who travels that road.',
    source: 'SAFEPATH community guidelines.',
    body: [
      'Describe what happened plainly, without naming private individuals or writing anything defamatory.',
      'Place the pin as accurately as you can — the map location is what other users rely on.',
      'Mention the time of day and conditions, such as broken street lights or a deserted stretch.',
      'Attach a photo only if it is safe to take one and does not show people\'s faces.',
      'Reports stay pending until a moderator verifies them. Approved reports appear as alerts to users nearby.',
      'Your identity is never shown on the public map.',
    ].join('\n'),
  },
];

const SAMPLE_REPORTS = [
  {
    category: 'poor_lighting',
    description:
      '[SAMPLE DATA] Street lights along this stretch are broken after the underpass, making the footpath very dark. Reported for demonstration of SAFEPATH scoring.',
    lat: 12.9756,
    lng: 77.6006,
    severity: 'medium',
    address: 'Sample location near MG Road, Bengaluru',
  },
  {
    category: 'suspicious_activity',
    description:
      '[SAMPLE DATA] Group loitering near the bus stop late at night. Demo record used to show how verified alerts appear on the map.',
    lat: 12.9699,
    lng: 77.5987,
    severity: 'high',
    address: 'Sample location near Cubbon Park, Bengaluru',
  },
  {
    category: 'unsafe_route',
    description:
      '[SAMPLE DATA] Desolate service lane with no shops or houses; demo report to illustrate alternative-route comparison.',
    lat: 12.9812,
    lng: 77.6069,
    severity: 'medium',
    address: 'Sample location near Trinity Circle, Bengaluru',
  },
];

async function main() {
  console.log('Seeding SAFEPATH ...');

  // 1. Administrator
  const adminHash = await bcrypt.hash(config.admin.password, 12);
  const existingAdmin = await q1('SELECT id FROM admins WHERE email = ?', [config.admin.email]);
  if (existingAdmin) {
    await q('UPDATE admins SET name = ?, password_hash = ?, role = ?, is_active = 1 WHERE id = ?', [
      config.admin.name,
      adminHash,
      'super_admin',
      existingAdmin.id,
    ]);
    console.log(`  admin updated: ${config.admin.email}`);
  } else {
    await insert(
      'INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [config.admin.name, config.admin.email, adminHash, 'super_admin'],
    );
    console.log(`  admin created: ${config.admin.email}`);
  }

  // 2. Demo user (explicitly labelled demo credentials in the UI + README)
  const demoEmail = 'demo@safepath.app';
  const demoHash = await bcrypt.hash('Demo@12345', 12);
  let demo = await q1('SELECT id FROM users WHERE email = ?', [demoEmail]);
  if (!demo) {
    const id = await insert(
      `INSERT INTO users (full_name, email, phone, city, password_hash, email_verified)
       VALUES (?, ?, ?, ?, ?, 1)`,
      ['Demo User', demoEmail, '+919800000000', 'Bengaluru', demoHash],
    );
    demo = { id };
    console.log('  demo user created: demo@safepath.app / Demo@12345');
  }

  // 3. Demo trusted contacts
  const contactCount = await q1('SELECT COUNT(*) AS c FROM emergency_contacts WHERE user_id = ?', [demo.id]);
  if (Number(contactCount.c) === 0) {
    await insert(
      `INSERT INTO emergency_contacts (user_id, name, phone, email, relationship, is_primary)
       VALUES (?, 'Demo Mother', '+919800000001', NULL, 'Mother', 1)`,
      [demo.id],
    );
    await insert(
      `INSERT INTO emergency_contacts (user_id, name, phone, email, relationship, is_primary)
       VALUES (?, 'Demo Friend', '+919800000002', NULL, 'Friend', 0)`,
      [demo.id],
    );
    console.log('  demo emergency contacts created (sample data)');
  }

  // 4. Sample verified reports (clearly labelled as sample)
  const reportCount = await q1('SELECT COUNT(*) AS c FROM safety_reports WHERE is_sample = 1');
  if (Number(reportCount.c) === 0) {
    for (const r of SAMPLE_REPORTS) {
      await insert(
        `INSERT INTO safety_reports
          (user_id, category, description, latitude, longitude, address, occurred_at, severity,
           status, verified_at, is_sample)
         VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 2 DAY), ?, 'verified', NOW(), 1)`,
        [demo.id, r.category, r.description, r.lat, r.lng, r.address, r.severity],
      );
    }
    console.log(`  ${SAMPLE_REPORTS.length} sample safety reports created (is_sample = 1)`);
  }

  // 5. Awareness content
  for (const [index, item] of AWARENESS.entries()) {
    const existing = await q1('SELECT id FROM awareness_content WHERE slug = ?', [item.slug]);
    if (existing) {
      await q(
        `UPDATE awareness_content
            SET title = ?, summary = ?, body = ?, category = ?, icon = ?, source = ?, sort_order = ?
          WHERE id = ?`,
        [item.title, item.summary, item.body, item.category, item.icon, item.source, index, existing.id],
      );
    } else {
      await insert(
        `INSERT INTO awareness_content
          (slug, title, summary, body, category, icon, source, sort_order, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [item.slug, item.title, item.summary, item.body, item.category, item.icon, item.source, index],
      );
    }
  }
  console.log(`  ${AWARENESS.length} safety awareness guides ready`);

  // 6. Settings
  const settings = [
    ['emergency_number', '112'],
    ['women_helpline', '181'],
    ['police_number', '100'],
    ['ambulance_number', '108'],
    ['cyber_helpline', '1930'],
  ];
  for (const [key, value] of settings) {
    await q(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value],
    );
  }

  console.log('\nSeed complete.');
  console.log('Admin login :', config.admin.email, '/', config.admin.password, '(change via .env)');
  console.log('Demo login  : demo@safepath.app / Demo@12345');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
