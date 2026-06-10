#!/usr/bin/env node
/**
 * 출시 초기 기준선 지표 수집 (읽기 전용).
 *
 * Supabase 운영 DB에서 가입/설문/리포트/상담/결제/구독 수치를 집계해
 * docs/work/BASELINE_METRICS.md 갱신에 쓸 JSON을 출력한다.
 * GA4 이벤트(report_viewed, pricing_viewed 등)는 여기서 못 보고
 * GA 콘솔에서 별도로 확인해야 한다.
 *
 * 사용: node scripts/collect-baseline-metrics.cjs [--since 2026-05-01]
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"|"$/g, '').replace(/\s+#.*$/, '').trim();
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다 (.env.local)');
  process.exit(1);
}

const sinceArgIndex = process.argv.indexOf('--since');
const since = sinceArgIndex >= 0 ? process.argv[sinceArgIndex + 1] : '2026-04-28';

const supabase = createClient(url, serviceKey);

async function fetchAll(table, columns) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      return { error: error.message, rows };
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return { rows };
}

function byDay(rows) {
  const days = {};
  for (const row of rows) {
    const day = String(row.created_at).slice(0, 10);
    days[day] = (days[day] ?? 0) + 1;
  }
  return days;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row[key] ?? 'null';
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  const result = { since, collectedAt: new Date().toISOString(), tables: {} };

  const specs = [
    ['profiles', 'created_at'],
    ['children', 'created_at'],
    ['surveys', 'created_at, type, status'],
    ['reports', 'created_at, type'],
    ['consultation_sessions', 'created_at'],
    ['consultations', 'created_at'],
    ['practice_items', 'created_at, status'],
    ['practice_logs', 'created_at, done'],
    ['observations', 'created_at'],
    ['payments', 'created_at, status, type, amount, currency'],
    ['subscriptions', 'created_at, status, source, plan, cancelled_at'],
    ['subscription_usage_events', 'created_at, event_name'],
  ];

  for (const [table, columns] of specs) {
    const { rows, error } = await fetchAll(table, columns);
    if (error) {
      result.tables[table] = { error };
      continue;
    }
    const entry = { total: rows.length, byDay: byDay(rows) };
    if (columns.includes('type')) entry.byType = countBy(rows, 'type');
    if (columns.includes('status')) entry.byStatus = countBy(rows, 'status');
    if (columns.includes('source')) entry.bySource = countBy(rows, 'source');
    if (columns.includes('event_name')) entry.byEvent = countBy(rows, 'event_name');
    if (table === 'payments') {
      entry.paidTotalKrw = rows
        .filter((row) => row.status === 'PAID' && row.currency === 'KRW')
        .reduce((sum, row) => sum + (row.amount ?? 0), 0);
    }
    if (table === 'subscriptions') {
      entry.cancelScheduled = rows.filter((row) => row.cancelled_at).length;
    }
    if (table === 'practice_logs') {
      entry.doneCount = rows.filter((row) => row.done).length;
    }
    result.tables[table] = entry;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
