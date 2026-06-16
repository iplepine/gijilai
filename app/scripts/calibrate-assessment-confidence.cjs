#!/usr/bin/env node
/**
 * 기질검사 신뢰도 캘리브레이션 러너.
 * 새 문항뱅크(차수화) 응답으로 SE_CONSTANT 를 실측 산출한다 — 임의값 18.0 대체용.
 * 수학은 src/lib/assessmentCalibration.ts(테스트 검증), 이 파일은 Supabase 연결+출력만.
 * 절차/해석: docs/operations/assessment-confidence-calibration.md
 *
 * 실행: node scripts/calibrate-assessment-confidence.cjs   (또는 npm run calibrate:assessment)
 * 필요: .env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (read-only 조회만)
 *
 * 주의: 새 뱅크 응답이 충분히 쌓이기 전엔 "데이터 부족"으로 보류된다(정상).
 */
const fs = require('fs');
const path = require('path');

// .env.local 로드 (기존 collect-baseline-metrics.cjs 패턴).
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"|"$/g, '').replace(/\s+#.*$/, '').trim();
  }
}

// TS 모듈(캘리브레이션 수학 + 문항뱅크)을 직접 require.
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' });
require('ts-node/register/transpile-only');
const { calibrateFromResponses } = require('../src/lib/assessmentCalibration');
const { CHILD_ASSESSMENT_BANK, DRAFT_CHILD_ITEM_IDS } = require('../src/data/childAssessmentBank');
const { createClient } = require('@supabase/supabase-js');

const MIN_N = 150; // 차원별 최소 표본(α 안정선). 근거: 절차 문서 §표본.

function fmt(x) {
  return Number.isFinite(x) ? x.toFixed(2) : 'n/a';
}

function toNumericKeys(a) {
  const out = {};
  for (const [k, v] of Object.entries(a || {})) {
    if (typeof v === 'number') out[Number(k)] = v;
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env.local).');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  // 아동 검사 응답 조회(read-only). answers = { questionId: 1-5 }.
  const { data, error } = await supabase.from('surveys').select('answers');
  if (error) {
    console.error('surveys 조회 실패:', error.message);
    process.exit(1);
  }

  const draftIds = new Set(DRAFT_CHILD_ITEM_IDS);
  // 새 뱅크를 실제로 사용한 응답만(DRAFT 문항이 답안에 등장).
  const responses = (data || [])
    .map((row) => toNumericKeys(row.answers))
    .filter((a) => Object.keys(a).some((id) => draftIds.has(Number(id))));

  console.log(`전체 surveys: ${(data || []).length}, 새 뱅크 응답: ${responses.length}`);
  if (responses.length === 0) {
    console.log('아직 새 뱅크 응답이 없습니다 — 데이터 수집 단계. 캘리브레이션 보류(정상).');
    return;
  }

  const report = calibrateFromResponses(responses, CHILD_ASSESSMENT_BANK);

  console.log('\n차원별 캘리브레이션:');
  for (const d of report.perDimension) {
    console.log(
      `  ${d.dimension}: N=${d.n} k=${d.k} α=${fmt(d.alpha)} SD=${fmt(d.scoreSd)} ` +
        `SEM=${fmt(d.sem)} → SE_CONSTANT=${fmt(d.seConstant)}`,
    );
  }
  console.log(`\n권장 SE_CONSTANT(중앙값): ${fmt(report.suggestedSeConstant)}   (현재 18.0)`);

  if (report.minDimensionN < MIN_N) {
    console.log(`\n⚠️  표본 부족(최소 차원 N=${report.minDimensionN} < ${MIN_N}). 더 수집 후 재실행 권장.`);
  } else {
    console.log('\n✅ 표본 충분. 위 값으로 assessmentConfig.SE_CONSTANT 갱신 + 밴드 검토 후 CONFIDENCE_CALIBRATED=true.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
