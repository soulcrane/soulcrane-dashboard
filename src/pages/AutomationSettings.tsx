// ────────────────────────────────────────────────────────────────
// 자동화 설정 (관리자)
//
// ★ 이 화면의 목적: 운영자가 코드를 건드리지 않고
//   - 플랫폼별 자동화 ON/OFF
//   - 채널ID/계정ID
//   - Cron 활성화 여부(자기보고)
//   를 관리하고, 마지막 동기화 결과와 로그를 확인할 수 있게 하는 것.
//
//   실제 값 저장은 automation_settings 테이블(관리자 anon 키로 직접 read/write),
//   실행 이력은 sync_logs 테이블(서버 함수가 기록, 여기서는 조회만).
//   YouTube 외 플랫폼은 아직 수집 로직(api/_lib/{platform}.ts)이 없어 '준비 중'으로 표시됩니다.
//   나중에 구현되면 AUTOMATION_PLATFORMS의 endpoint만 채우면 이 화면은 그대로 동작합니다.
// ────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { colors } from '../theme/theme';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

interface AutomationSetting {
  platform: string;
  enabled: boolean;
  external_account_id: string | null;
  cron_enabled: boolean;
  updated_at: string;
}

interface SyncLog {
  id: string;
  platform: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  success: boolean;
  processed_count: number;
  new_video_count: number;
  error_message: string | null;
  warnings: string[] | null;
}

interface StatusResponse {
  supabase: { urlSet: boolean; serviceRoleKeySet: boolean };
  auth: { cronSecretSet: boolean; adminTriggerTokenSet: boolean };
  platforms: Record<string, { apiKeySet: boolean }>;
}

// 새 플랫폼 자동화를 추가할 때는 이 배열에 한 줄만 추가하면 화면이 자동으로 확장됩니다.
const AUTOMATION_PLATFORMS: { platform: string; label: string; endpoint: string | null }[] = [
  { platform: 'youtube', label: '유튜브', endpoint: '/api/collect-youtube' },
  { platform: 'instagram', label: '인스타그램', endpoint: '/api/collect-instagram' },
  { platform: 'facebook', label: '페이스북', endpoint: '/api/collect-facebook' },
  { platform: 'tiktok', label: '틱톡', endpoint: null },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AutomationSettings() {
  const [settings, setSettings] = useState<Record<string, AutomationSetting>>({});
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningPlatform, setRunningPlatform] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, any>>({});
  const [message, setMessage] = useState('');

  const notify = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const load = async () => {
    if (!isSupabaseEnabled || !supabase) { setLoading(false); return; }
    setLoading(true);
    const [settingsRes, logsRes, statusJson] = await Promise.all([
      supabase.from('automation_settings').select('*'),
      supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(10),
      fetch('/api/automation-status').then((r) => r.json()).catch(() => null),
    ]);
    if (settingsRes.data) {
      const map: Record<string, AutomationSetting> = {};
      (settingsRes.data as AutomationSetting[]).forEach((s) => { map[s.platform] = s; });
      setSettings(map);
    }
    if (logsRes.data) setLogs(logsRes.data as SyncLog[]);
    setStatus(statusJson);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patchSetting = async (platform: string, patch: Partial<AutomationSetting>) => {
    if (!supabase) return;
    setSettings((s) => ({ ...s, [platform]: { ...s[platform], ...patch } as AutomationSetting }));
    const { error } = await supabase.from('automation_settings').update(patch).eq('platform', platform);
    if (error) notify(`저장 실패: ${error.message}`);
  };

  const runNow = async (platform: string, endpoint: string) => {
    setRunningPlatform(platform);
    try {
      const token = (import.meta.env as Record<string, string | undefined>).VITE_ADMIN_TRIGGER_TOKEN;
      const resp = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await resp.json();
      setRunResult((r) => ({ ...r, [platform]: json }));
      notify(
        resp.ok && json.success
          ? `${platform} 동기화 완료 (처리 ${json.processedCount ?? 0}건 · 신규 ${json.newVideoCount ?? 0}건)`
          : `${platform} 동기화 실패: ${json.error ?? json.errorMessage ?? '알 수 없는 오류'}`,
      );
      await load();
    } catch (err: any) {
      notify(`동기화 요청 중 오류: ${err?.message ?? String(err)}`);
    } finally {
      setRunningPlatform(null);
    }
  };

  if (!isSupabaseEnabled) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: colors.text }}>자동화 설정</h1>
        </div>
        <EmptyState
          title="Supabase 연결이 필요합니다"
          description="자동화 기능은 공유 DB(Supabase) 연결 상태에서만 사용할 수 있습니다. 현재는 로컬 저장 모드입니다."
        />
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 40, color: colors.textMuted, fontSize: 13 }}>불러오는 중…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>자동화 설정</h1>
        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
          플랫폼별 자동 수집을 켜고 끄거나, 채널/계정 ID를 관리하고, 동기화 이력을 확인합니다
        </p>
      </div>

      {message && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: colors.positiveSoft, color: colors.positive,
          border: `1px solid ${colors.border}`,
        }}>
          {message}
        </div>
      )}

      {/* 환경 상태 */}
      <Card>
        <SectionHeading title="환경 상태" subtitle="Vercel 환경변수 등록 여부 (실제 값은 표시하지 않습니다)" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {[
            { label: 'Supabase URL', ok: status?.supabase.urlSet },
            { label: 'Service Role Key', ok: status?.supabase.serviceRoleKeySet },
            { label: 'CRON_SECRET', ok: status?.auth.cronSecretSet },
            { label: 'ADMIN_TRIGGER_TOKEN', ok: status?.auth.adminTriggerTokenSet },
          ].map((it) => (
            <div key={it.label} style={{
              padding: '10px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
              background: colors.surface,
            }}>
              <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>{it.label}</div>
              <div style={{
                fontSize: 13, fontWeight: 500,
                color: it.ok ? colors.positive : colors.negative,
              }}>
                {status === null ? '확인 불가' : it.ok ? '설정됨' : '미설정'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 플랫폼별 카드 */}
      {AUTOMATION_PLATFORMS.map(({ platform, label, endpoint }) => {
        const s = settings[platform];
        const lastLog = logs.find((l) => l.platform === platform);
        const apiKeySet = status?.platforms[platform]?.apiKeySet ?? false;
        const isReady = endpoint !== null;
        const isRunning = runningPlatform === platform;
        const result = runResult[platform];

        return (
          <Card key={platform}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div className="flex items-center gap-2">
                <SectionHeading title={label} subtitle={isReady ? undefined : '수집 로직 준비 중 — 설정만 미리 등록 가능'} />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs" style={{ color: colors.textMuted }}>
                  <input
                    type="checkbox"
                    checked={s?.enabled ?? false}
                    onChange={(e) => patchSetting(platform, { enabled: e.target.checked })}
                  />
                  자동화 사용
                </label>
                <Button
                  variant="primary"
                  onClick={() => endpoint && runNow(platform, endpoint)}
                >
                  {isRunning ? '실행 중…' : '지금 동기화'}
                </Button>
              </div>
            </div>

            {!isReady && (
              <p className="text-xs mb-3" style={{ color: colors.textFaint }}>
                이 플랫폼의 수집 함수(api/collect-{platform}.ts)가 아직 구현되지 않아 버튼을 눌러도 동작하지 않습니다.
                운영 체크리스트의 "신규 플랫폼 추가 방법"을 참고하세요.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 좌측: 설정 */}
              <div className="flex flex-col gap-3">
                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                    채널 ID / 계정 ID
                  </span>
                  <input
                    type="text"
                    defaultValue={s?.external_account_id ?? ''}
                    placeholder="예: UCxxxxxxxxxxxxxxxxxxxxxx"
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value !== (s?.external_account_id ?? '')) {
                        patchSetting(platform, { external_account_id: value || null });
                      }
                    }}
                    style={{
                      width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${colors.border}`, background: colors.surface,
                      color: colors.text, outline: 'none',
                    }}
                  />
                </label>

                <label className="flex items-center gap-2 text-xs" style={{ color: colors.textMuted }}>
                  <input
                    type="checkbox"
                    checked={s?.cron_enabled ?? false}
                    onChange={(e) => patchSetting(platform, { cron_enabled: e.target.checked })}
                  />
                  Cron 활성화됨 (vercel.json에 crons를 실제로 추가했다면 직접 체크 — 자동 감지 아님)
                </label>

                <div className="text-xs" style={{ color: colors.textMuted }}>
                  API Key 설정 여부:{' '}
                  <span style={{ color: apiKeySet ? colors.positive : colors.negative, fontWeight: 500 }}>
                    {apiKeySet ? '설정됨' : '미설정'}
                  </span>
                </div>
              </div>

              {/* 우측: 마지막 동기화 요약 */}
              <div style={{
                padding: 12, borderRadius: 8, border: `1px solid ${colors.border}`,
                background: colors.surface, fontSize: 12, color: colors.textMuted,
              }}>
                {lastLog ? (
                  <>
                    <div className="flex justify-between mb-1">
                      <span>마지막 동기화</span>
                      <span style={{ color: colors.text }}>{formatDateTime(lastLog.started_at)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>결과</span>
                      <span style={{ color: lastLog.success ? colors.positive : colors.negative, fontWeight: 500 }}>
                        {lastLog.success ? '성공' : '실패'}
                      </span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>처리된 영상 수</span>
                      <span style={{ color: colors.text }}>{lastLog.processed_count}건</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>신규 등록</span>
                      <span style={{ color: colors.text }}>{lastLog.new_video_count}건</span>
                    </div>
                    <div className="flex justify-between">
                      <span>소요 시간</span>
                      <span style={{ color: colors.text }}>{lastLog.duration_ms ? `${lastLog.duration_ms}ms` : '—'}</span>
                    </div>
                    {lastLog.error_message && (
                      <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${colors.border}`, color: colors.negative }}>
                        {lastLog.error_message}
                      </div>
                    )}
                  </>
                ) : (
                  <span>아직 실행 기록이 없습니다.</span>
                )}
              </div>
            </div>

            {result && (
              <div className="mt-3 text-xs" style={{
                padding: '8px 10px', borderRadius: 6, color: colors.textMuted,
                background: colors.surfaceHi, border: `1px solid ${colors.border}`,
              }}>
                방금 실행 결과: {result.success ? '성공' : '실패'} · 처리 {result.processedCount ?? 0}건 ·
                신규 {result.newVideoCount ?? 0}건
                {Array.isArray(result.warnings) && result.warnings.length > 0 && (
                  <> · 경고 {result.warnings.length}건</>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {/* 최근 로그 */}
      <Card>
        <SectionHeading title="최근 동기화 로그" subtitle="최근 10건 (모든 플랫폼)" />
        {logs.length === 0 ? (
          <EmptyState title="기록이 없습니다" description="자동화를 실행하면 여기에 이력이 쌓입니다." />
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['플랫폼', '시작 시간', '결과', '처리', '신규', '소요', '실패 원인'].map((h) => (
                    <th key={h} style={{
                      fontSize: 11, fontWeight: 500, color: colors.textMuted,
                      padding: '6px 8px', textAlign: 'left',
                      borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}` }}>{l.platform}</td>
                    <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}>
                      {formatDateTime(l.started_at)}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`,
                                 color: l.success ? colors.positive : colors.negative }}>
                      {l.success ? '성공' : '실패'}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}` }}>{l.processed_count}</td>
                    <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}` }}>{l.new_video_count}</td>
                    <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      {l.duration_ms ? `${l.duration_ms}ms` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.negative }}>
                      {l.error_message ?? (l.warnings && l.warnings.length > 0 ? `경고 ${l.warnings.length}건` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
