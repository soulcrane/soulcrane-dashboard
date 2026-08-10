// ────────────────────────────────────────────────────────────────
// 주간 데이터 입력 (관리자)
//
// ★ 이 화면이 시스템의 '입구'입니다.
//   여기서 저장하면 → 전역 스토어(DataContext)가 갱신되고 →
//   대시보드 · 플랫폼 분석 · 주간 비교 · AI 분석이 전부 자동으로 다시 계산됩니다.
//   (엑셀에서 4개 시트에 중복 입력하던 작업이 여기 한 번으로 끝납니다)
//
// 구성: ① 조사 주차 선택/생성  ② 엑셀형 표 입력  ③ 신규 콘텐츠 등록  ④ 팔로워 입력
// ────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { Button } from '../components/common/Button';
import { PlatformBadge } from '../components/common/PlatformBadge';
import { TextField, SelectField } from '../components/common/Field';
import { EmptyState } from '../components/common/EmptyState';
import { useData } from '../store/DataContext';
import { surveyDatesDesc, PLATFORMS } from '../lib/metrics';
import { colors, platformLabels, contentTypeLabels } from '../theme/theme';
import { formatDate } from '../lib/format';
import type { Platform, ContentType, Video, WeeklyMetric } from '../types';

// 플랫폼마다 입력 가능한 지표가 다릅니다 (요구사항 반영)
//   유튜브: 조회/좋아요/댓글        인스타·페북: +공유        틱톡: +저장
const SUPPORTS_SAVES: Platform[] = ['tiktok', 'douyin'];
const SUPPORTS_SHARES: Platform[] = ['instagram', 'facebook', 'douyin'];
const SUPPORTS_LINK_ID: Platform[] = ['youtube', 'instagram', 'facebook'];

export function WeeklyInput() {
  const {
    videos, metrics, followers,
    upsertMetric, deleteMetric, deleteSurveyDate,
 
    addVideo, updateVideo, deleteVideo, upsertFollower, resetToSeed,
 
  } = useData();

  const dates = surveyDatesDesc(metrics);
  const [surveyDate, setSurveyDate] = useState(dates[0] ?? new Date().toISOString().slice(0, 10));
  const [newDate, setNewDate] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<'all' | Platform>('all');
  const [message, setMessage] = useState('');

  // 신규 콘텐츠 등록 폼 상태
  const [showNewForm, setShowNewForm] = useState(false);
  const [nv, setNv] = useState({
  platform: 'youtube' as Platform,
  contentType: 'short' as ContentType,
  title: '',
  uploadDate: '',
  url: '',
  externalVideoId: '',
});

  // 현재 주차의 수치를 videoId → metric 으로 빠르게 찾기
  const currentMetrics = useMemo(() => {
    const map = new Map<string, WeeklyMetric>();
    metrics.filter((m) => m.surveyDate === surveyDate).forEach((m) => map.set(m.videoId, m));
    return map;
  }, [metrics, surveyDate]);

  // 표에 보여줄 영상 목록 (플랫폼 필터 적용)
  const rows = useMemo(
    () => videos.filter((v) => filterPlatform === 'all' || v.platform === filterPlatform),
    [videos, filterPlatform],
  );

  const notify = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  };

  // ── 표의 한 칸을 수정하면 즉시 저장 ──
  const handleCellChange = async (
    video: Video,
    field: 'views' | 'likes' | 'comments' | 'saves' | 'shares',
    raw: string,
  ) => {
    const value = raw === '' ? 0 : Number(raw.replace(/[^0-9]/g, ''));
    if (Number.isNaN(value)) return;

    const existing = currentMetrics.get(video.id);
    const base: WeeklyMetric = existing ?? {
      videoId: video.id,
      surveyDate,
      views: 0, likes: 0, comments: 0,
      saves: SUPPORTS_SAVES.includes(video.platform) ? 0 : null,
      shares: SUPPORTS_SHARES.includes(video.platform) ? 0 : null,
    };
    await upsertMetric({ ...base, [field]: value });
  };

    // ── 콘텐츠 URL로 실제 Graph API media ID 자동 조회 ──
  const resolveMediaId = async (platform: Platform, url: string): Promise<string | null> => {
    if (!url.trim()) { notify('먼저 게시물 URL을 입력해 주세요.'); return null; }
    const endpoint = platform === 'instagram' ? '/api/resolve-instagram-media' : platform === 'facebook' ? '/api/resolve-facebook-media' : null;
    if (!endpoint) return null;
    try {
      const token = (import.meta.env as Record<string, string | undefined>).VITE_ADMIN_TRIGGER_TOKEN;
      const resp = await fetch(endpoint + '?url=' + encodeURIComponent(url.trim()), {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        notify('조회 실패: ' + (json.error || '알 수 없는 오류'));
        return null;
      }
      notify('실제 게시물 ID를 찾았습니다: ' + json.mediaId);
      return json.mediaId as string;
    } catch (e) {
      notify('조회 중 오류가 발생했습니다: ' + (e as Error).message);
      return null;
    }
  };

// ── 신규 콘텐츠 등록 ──
  const handleAddVideo = async () => {
    if (!nv.title.trim()) return notify('영상명을 입력해 주세요.');
    if (!nv.uploadDate) return notify('업로드일을 선택해 주세요.');

    // VideoID 자동 생성: 플랫폼_유형_영상명 (엑셀의 기존 규칙 유지)
    const prefixMap: Record<Platform, string> = {
      youtube: 'YT', instagram: 'IG', tiktok: 'TT', facebook: 'FB', douyin: 'DY',
    };
    const prefix = prefixMap[nv.platform];
    const typeCode = nv.contentType === 'short' ? 'SF' : 'LF';
    const slug = nv.title.replace(/[^가-힣a-zA-Z0-9]/g, '');
    let id = `${prefix}_${typeCode}_${slug}`;
    if (videos.some((v) => v.id === id)) id = `${id}_${Date.now().toString().slice(-4)}`;

    const video: Video = {
      id,
      platform: nv.platform,
      contentType: nv.contentType,
      managementGroup: 'platform',   // 신규는 기본 플랫폼 콘텐츠
      title: nv.title.trim(),
      contentGroup: nv.title.replace(/^(SF\.|LF\.)\s*/, '').trim(),
      uploadDate: nv.uploadDate,
      url: nv.url.trim(),
 
      externalVideoId: SUPPORTS_LINK_ID.includes(nv.platform) ? nv.externalVideoId.trim() || null : null,
    };
await addVideo(video);

setNv({
  platform: 'youtube',
  contentType: 'short',
  title: '',
  uploadDate: '',
  url: '',
  externalVideoId: '',
});

notify('콘텐츠를 등록했습니다.');
};

// ── 새 조사 주차 만들기 ──
const handleCreateWeek = () => {
    if (!newDate) return notify('새 조사일을 선택해 주세요.');
    setSurveyDate(newDate);
    setNewDate('');
    notify(`${formatDate(newDate)} 조사 주차를 시작했습니다. 아래 표에 수치를 입력하세요.`);
  };

  const inputStyle = {
    width: '100%', fontSize: 13, padding: '5px 8px', borderRadius: 6,
    border: `1px solid ${colors.border}`, background: colors.surface,
    color: colors.text, textAlign: 'right' as const, outline: 'none' as const,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>주간 데이터 입력</h1>
        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
          표에서 바로 수정하면 자동 저장되고, 모든 화면에 즉시 반영됩니다
        </p>
      </div>

      {/* 저장 알림 */}
      {message && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: colors.positiveSoft, color: colors.positive,
          border: `1px solid ${colors.border}`,
        }}>
          {message}
        </div>
      )}

      {/* ① 조사 주차 관리 */}
      <Card>
        <SectionHeading title="조사 주차" subtitle="입력할 주차를 고르거나 새 주차를 시작하세요" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <SelectField
            label="입력 중인 조사일"
            value={surveyDate}
            onChange={setSurveyDate}
            options={
              dates.includes(surveyDate)
                ? dates.map((d) => ({ value: d, label: formatDate(d) }))
                : [{ value: surveyDate, label: `${formatDate(surveyDate)} (새 주차)` },
                   ...dates.map((d) => ({ value: d, label: formatDate(d) }))]
            }
          />
          <TextField label="새 조사일 추가" type="date" value={newDate} onChange={setNewDate} />
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleCreateWeek}>새 주차 시작</Button>
            {dates.includes(surveyDate) && dates.length > 1 && (
              <Button onClick={async () => {
                if (confirm(`${formatDate(surveyDate)} 주차의 모든 수치를 삭제할까요?`)) {
                  await deleteSurveyDate(surveyDate);
                  setSurveyDate(dates.find((d) => d !== surveyDate) ?? '');
                  notify('해당 주차를 삭제했습니다.');
                }
              }}>주차 삭제</Button>
            )}
          </div>
        </div>
      </Card>

      {/* ③ 신규 콘텐츠 등록 */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading title="콘텐츠 관리" subtitle={`등록된 콘텐츠 ${videos.length}개`} />
          <Button variant="primary" onClick={() => setShowNewForm((s) => !s)}>
            {showNewForm ? '닫기' : '+ 신규 콘텐츠 등록'}
          </Button>
        </div>

        {showNewForm && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-3"
               style={{ borderTop: `1px solid ${colors.border}` }}>
            <SelectField label="플랫폼" value={nv.platform}
              onChange={(v) => setNv({ ...nv, platform: v })}
              options={PLATFORMS.map((p) => ({ value: p, label: platformLabels[p] }))} />
            <SelectField label="콘텐츠 유형" value={nv.contentType}
              onChange={(v) => setNv({ ...nv, contentType: v })}
              options={[{ value: 'short' as ContentType, label: '숏폼' },
                        { value: 'long' as ContentType, label: '롱폼' }]} />
            <TextField label="영상명" value={nv.title}
              onChange={(v) => setNv({ ...nv, title: v })} placeholder="예: SF. 신규 클립" />
            <TextField label="업로드일" type="date" value={nv.uploadDate}
              onChange={(v) => setNv({ ...nv, uploadDate: v })} />
            <TextField label="원본 링크" value={nv.url}
              onChange={(v) => setNv({ ...nv, url: v })} placeholder="https://..." />
 
            {SUPPORTS_LINK_ID.includes(nv.platform) && (
              <TextField
                label={nv.platform === 'youtube' ? '유튜브 영상 ID (자동 수집용)' : nv.platform === 'instagram' ? '인스타그램 게시물 ID (자동 수집용)' : '페이스북 게시물 ID (자동 수집용)'}
                value={nv.externalVideoId}
                onChange={(v) => setNv({ ...nv, externalVideoId: v })}
                placeholder={nv.platform === 'youtube' ? '예: dQw4w9WgXcQ (링크의 v= 뒤 11자리)' : '예: 게시물 URL의 고유 ID'}
              />
            )}
            {(nv.platform === 'instagram' || nv.platform === 'facebook') && (
              <Button variant="ghost" onClick={async () => {
                const id = await resolveMediaId(nv.platform, nv.url);
                if (id) setNv({ ...nv, externalVideoId: id });
              }}>
                위 '원본 링크'로 실제 ID 조회
              </Button>
            )}


 
            <Button variant="primary" onClick={handleAddVideo}>콘텐츠 등록</Button>
          </div>
        )}
      </Card>

      {/* ② 엑셀형 표 입력 */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <SectionHeading
            title={`${formatDate(surveyDate)} 성과 입력`}
            subtitle="칸을 클릭해 숫자를 입력하면 자동 저장됩니다 · 플랫폼에 없는 지표는 비활성"
          />
          <div style={{ minWidth: 180 }}>
            <SelectField label="" value={filterPlatform} onChange={setFilterPlatform}
              options={[{ value: 'all' as const, label: '전체 플랫폼' },
                ...PLATFORMS.map((p) => ({ value: p, label: platformLabels[p] }))]} />
          </div>
        </div>

        <Card style={{ padding: 8 }}>
          {rows.length === 0 ? (
            <EmptyState title="등록된 콘텐츠가 없습니다"
              description="위의 [+ 신규 콘텐츠 등록]으로 콘텐츠를 먼저 추가해 주세요." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
 
                    {['영상명', '플랫폼', '유형', '링크 ID', '조회수', '좋아요', '댓글', '저장', '공유', ''].map((h, i) => (
                      <th key={h + i} style={{
                        fontSize: 12, fontWeight: 500, color: colors.textMuted,
                        padding: '8px 10px', textAlign: i >= 4 && i <= 8 ? 'right' : 'left',

                        borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => {
                    const m = currentMetrics.get(v.id);
                    const canSave = SUPPORTS_SAVES.includes(v.platform);
                    const canShare = SUPPORTS_SHARES.includes(v.platform);
                    const cell = (
                      field: 'views' | 'likes' | 'comments' | 'saves' | 'shares',
                      enabled: boolean,
                    ) => (
                      <td style={{ padding: '6px 10px', borderBottom: `1px solid ${colors.border}`, width: 96 }}>
                        {enabled ? (
                          <input
                            type="text" inputMode="numeric"
                            value={m?.[field] ?? ''}
                            placeholder="0"
                            onChange={(e) => handleCellChange(v, field, e.target.value)}
                            style={inputStyle}
                          />
                        ) : (
                          <span style={{ display: 'block', textAlign: 'right', color: colors.textFaint }}>—</span>
                        )}
                      </td>
                    );
                    return (
                      <tr key={v.id}>
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${colors.border}`,
                                     color: colors.text, minWidth: 180 }}>
                          {v.title}
                          {v.managementGroup === 'main' && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: colors.highlight }}>⭐</span>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${colors.border}` }}>
                          <PlatformBadge platform={v.platform} />
                        </td>
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${colors.border}`,
                                     color: colors.textMuted, whiteSpace: 'nowrap' }}>
                          {contentTypeLabels[v.contentType]}
                        </td>
 
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${colors.border}`, width: 140 }}>
                          {SUPPORTS_LINK_ID.includes(v.platform) ? (
                            <input
                              type="text"
                              defaultValue={v.externalVideoId ?? ''}
                              placeholder="링크 ID 입력"
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value !== (v.externalVideoId ?? '')) {
                                  updateVideo(v.id, { externalVideoId: value || null });
                                  notify(`'${v.title}'의 링크 ID를 저장했습니다.`);
                                }
                              }}
                              style={{ ...inputStyle, textAlign: 'left' as const }}
                            />
                            {(v.platform === 'instagram' || v.platform === 'facebook') && (
                              <button
                                type="button"
                                onClick={async () => {
                                  let sourceUrl = v.url;
                                  if (!sourceUrl) {
                                    sourceUrl = window.prompt('게시물 URL을 입력해 주세요.') || '';
                                    if (!sourceUrl) return;
                                  }
                                  const id = await resolveMediaId(v.platform, sourceUrl);
                                  if (id) {
                                    updateVideo(v.id, { externalVideoId: id, url: sourceUrl });
                                    notify('\'' + v.title + '\'의 링크 ID를 저장했습니다. (' + id + ')');
                                  }
                                }}
                                style={{ marginLeft: 4, fontSize: 11 }}
                              >
                                조회
                              </button>
                            )}
                          ) : (
                            <span style={{ display: 'block', color: colors.textFaint }}>—</span>
                          )}
                        </td>

 
                        {cell('views', true)}
                        {cell('likes', true)}
                        {cell('comments', true)}
                        {cell('saves', canSave)}
                        {cell('shares', canShare)}
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${colors.border}`,
                                     whiteSpace: 'nowrap' }}>
                          {m && (
                            <button
                              onClick={async () => {
                                await deleteMetric(v.id, surveyDate);
                                notify(`'${v.title}'의 이번 주 수치를 삭제했습니다.`);
                              }}
                              style={{ fontSize: 11, color: colors.negative, background: 'none',
                                       border: 'none', cursor: 'pointer', marginRight: 8 }}>
                              수치 삭제
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (confirm(`'${v.title}' 콘텐츠를 삭제할까요? 모든 주차 수치도 함께 삭제됩니다.`)) {
                                await deleteVideo(v.id);
                                notify(`'${v.title}' 콘텐츠를 삭제했습니다.`);
                              }
                            }}
                            style={{ fontSize: 11, color: colors.textMuted, background: 'none',
                                     border: 'none', cursor: 'pointer' }}>
                            콘텐츠 삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ④ 플랫폼 팔로워 입력 */}
      <Card>
        <SectionHeading title="플랫폼 팔로워 / 구독자" subtitle={`${formatDate(surveyDate)} 기준`} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLATFORMS.map((p) => {
            const f = followers.find((x) => x.platform === p && x.surveyDate === surveyDate);
            return (
              <TextField
                key={p}
                label={platformLabels[p]}
                value={f ? String(f.followers) : ''}
                onChange={(val) => {
                  const n = val === '' ? 0 : Number(val.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(n)) upsertFollower({ platform: p, surveyDate, followers: n });
                }}
                placeholder="0"
              />
            );
          })}
        </div>
      </Card>

      {/* 데이터 초기화 */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium" style={{ color: colors.text }}>데이터 초기화</p>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              입력한 내용을 모두 지우고 최초 62개 시드 데이터로 되돌립니다. (테스트 후 정리용)
            </p>
          </div>
          <Button onClick={async () => {
            if (confirm('모든 변경 내용을 지우고 초기 데이터로 되돌릴까요?')) {
              await resetToSeed();
              notify('초기 데이터로 되돌렸습니다.');
            }
          }}>초기 데이터로 되돌리기</Button>
        </div>
      </Card>
    </div>
  );
}
