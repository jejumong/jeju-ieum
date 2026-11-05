// 제주이음 · 바뀐 항목 찾아 무료 브라우저 알림 보내기 (GitHub Actions 에서 실행)
// - 직전 커밋과 지금 커밋의 데이터 파일을 비교합니다.
// - 학교 연계 주택: status 가 "open"(빈자리·모집 중)으로 바뀌면 → 태그 house_<id>=1 구독자에게
// - 지원 프로그램: status 가 "open"(모집 중)으로 바뀌거나 새로 생기면 → 태그 programs=1 구독자에게
// 테스트: node scripts/notify-changes.mjs --dry  (보내지 않고 보낼 내용만 출력)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const DRY = process.argv.includes("--dry") || !process.env.ONESIGNAL_API_KEY;
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_API_KEY;
const SITE = (process.env.SITE_URL || "").replace(/\/?$/, "/");

function load(src, names) {
  if (!src) return {};
  const ctx = {};
  try { vm.runInNewContext(src, ctx, { timeout: 2000 }); } catch (e) { console.log("읽기 실패:", e.message); return {}; }
  const out = {}; names.forEach(n => out[n] = ctx[n]); return out;
}
function prev(path) {
  try { return execSync(`git show HEAD~1:${path}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return ""; }
}
function now(path) { try { return readFileSync(path, "utf8"); } catch { return ""; } }

async function send(tag, heading, message, url) {
  const body = {
    app_id: APP_ID,
    target_channel: "push",
    filters: [{ field: "tag", key: tag, relation: "=", value: "1" }],
    headings: { en: heading, ko: heading },
    contents: { en: message, ko: message },
    url: url || SITE || undefined
  };
  if (DRY) { console.log("[미리보기]", tag, "|", heading, "|", message, "|", body.url || ""); return; }
  const r = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Key ${API_KEY}` },
    body: JSON.stringify(body)
  });
  console.log(tag, r.status, await r.text());
}

const jobs = [];

// 1) 학교 연계 주택
{
  const P = "assets/school-housing-data.js";
  const a = load(prev(P), ["SCHOOL_HOUSES"]).SCHOOL_HOUSES || [];
  const b = load(now(P), ["SCHOOL_HOUSES"]).SCHOOL_HOUSES || [];
  const before = Object.fromEntries(a.map(h => [h.id, h]));
  for (const h of b) {
    const was = before[h.id];
    if (h.status === "open" && (!was || was.status !== "open")) {
      jobs.push(send(`house_${h.id}`,
        `🏫 ${h.name} 빈자리 소식`,
        `${h.school} ${h.village} — 입주자 모집·빈자리가 확인됐어요. ${h.telLabel || "리사무소"}${h.tel ? " " + h.tel : ""}에 바로 문의해 보세요.`,
        SITE ? `${SITE}realestate.html?house=${h.id}#school-stay` : ""));
    }
  }
}

// 2) 장기체류·정착 지원 프로그램
{
  const P = "assets/programs-data.js";
  const a = load(prev(P), ["PROGRAMS"]).PROGRAMS || [];
  const b = load(now(P), ["PROGRAMS"]).PROGRAMS || [];
  const before = Object.fromEntries(a.map(p => [p.name, p]));
  const opened = b.filter(p => p.status === "open" && (!before[p.name] || before[p.name].status !== "open"));
  if (opened.length) {
    const first = opened[0];
    jobs.push(send("programs",
      opened.length > 1 ? `🧳 지원 공고 ${opened.length}건 모집 시작` : `🧳 ${first.name} 모집 시작`,
      opened.map(p => `${p.name} — ${p.when}`).join(" / ").slice(0, 230),
      SITE ? `${SITE}stay.html#programs-top` : ""));
  }
}

await Promise.all(jobs);
console.log(jobs.length ? `알림 ${jobs.length}건 처리` : "새로 알릴 변화가 없어요");
