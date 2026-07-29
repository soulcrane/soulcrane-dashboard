# SNS 자동 수집 — 운영 체크리스트 (최종)

YouTube 자동 수집(신규 영상 등록 + 성과 수집)을 실제 운영에 반영하는 순서입니다.
Instagram/Facebook/TikTok도 동일한 구조로 확장하도록 설계되어 있습니다 (8번 참고).

## 구조 요약

```
관리자 화면(자동화 설정)                    Vercel Cron (활성화 전까지는 미사용)
   │ ON/OFF, 채널ID 관리, '지금 동기화'            │ 매주 1회 자동 호출
   │ (automation_settings 테이블 직접 read/write)  │
   └──────────────┬───────────────────────────────┘
                   ▼
        /api/collect-youtube.ts  (인증 확인 → 실행 → sync_logs 기록)
                   │
                   ▼
        api/_lib/youtube.ts
          1) automation_settings에서 enabled/채널ID 조회 (꺼져 있으면 즉시 종료)
          2) 채널 업로드 목록 조회 → DB와 비교 → 신규 판별
          3) 통계 배치 조회 → 신규 등록 + weekly_metrics upsert
          4) 개별 실패는 건너뛰고 계속 진행
```

핵심 원칙:
- **채널ID·ON/OFF는 코드 수정 없이 관리자 화면에서 즉시 반영**됩니다 (DB 저장, 재배포 불필요).
- **API 키(YouTube, Supabase service_role) 같은 진짜 비밀값만 Vercel 환경변수**로 관리합니다.
- **신규 영상은 자동 등록**되지만, **관리자가 수정한 `title`은 자동화가 절대 덮어쓰지 않습니다.**
  원본 제목은 `source_title` 컬럼에 별도로 추적됩니다.
- **개별 영상 실패는 건너뛰고 계속 진행**합니다. 채널 전체 동기화가 영상 하나 때문에 중단되지 않습니다.
- **모든 실행 결과는 `sync_logs`에 기록**됩니다 (성공/실패 관계없이).
- **Cron은 기본적으로 꺼져 있습니다.** 수동 실행으로 검증 후 직접 활성화해야 합니다.
- **`platform + external_video_id`가 모든 플랫폼 공통 자연키**입니다. 새 플랫폼도 이 구조를 그대로 씁니다.

---

## 1. Google API 발급

1. https://console.cloud.google.com 접속 → 새 프로젝트 생성
2. **API 및 서비스 → 라이브러리** → `YouTube Data API v3` 검색 → **사용 설정**
3. **API 및 서비스 → 사용자 인증 정보 → + 사용자 인증 정보 만들기 → API 키**
4. 생성된 키의 **API 제한**을 "YouTube Data API v3"로 제한 (권장)
5. 이 키를 복사 → `YOUTUBE_API_KEY` 환경변수로 사용 (3단계에서 등록)

**채널 ID는 이 단계에서 확인만 해두고, 실제 입력은 관리자 화면(4단계)에서 합니다.**
- 채널 URL이 `youtube.com/channel/UC...` 형태면 그 `UC...`가 채널 ID입니다.
- `@핸들`만 있다면 채널 페이지 → 공유 → 채널 ID 복사로 확인합니다.

**할당량**: 하루 10,000 유닛(무료) 중 실행 1회당 대략 `1(채널조회) + 페이지수(업로드목록) + 배치수(통계조회)`
유닛 정도만 소비합니다 (영상 수백 개 기준으로도 여유 있음).

---

## 2. Supabase SQL 실행

Supabase 대시보드 → SQL Editor에서 순서대로 실행합니다.

- **완전히 처음 설정하는 경우**: `supabase_schema.sql` → `supabase_migration_v2_auto_register_and_logs.sql` → `supabase_migration_v3_automation_settings.sql`
- **v1(`supabase_migration_youtube_automation.sql`)을 이미 실행한 경우**: v2 → v3 순서로 추가 실행
- **v1은 건너뛰어도 무방합니다** (v2가 v1 실행 여부와 상관없이 안전하게 동작하도록 작성됨)

실행 후 확인:
```sql
select column_name from information_schema.columns where table_name = 'videos';
-- external_video_id, source_title 이 보이면 정상

select * from sync_logs order by started_at desc limit 5;
-- 아직 실행 전이면 빈 결과가 정상 (테이블 존재만 확인)

select * from automation_settings;
-- youtube/instagram/facebook/tiktok 4행이 enabled=false로 보이면 정상
```

---

## 3. Vercel 환경변수 등록

Vercel 프로젝트 → **Settings → Environment Variables** (Production + Preview 권장)

| 변수명 | 값 | 비고 |
|---|---|---|
| `SUPABASE_URL` | 기존 `VITE_SUPABASE_URL`과 동일 | 비밀 아님 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role | ⚠️ 매우 민감, 절대 커밋 금지 |
| `YOUTUBE_API_KEY` | 1단계에서 발급한 키 | 서버 전용 |
| `CRON_SECRET` | 랜덤 문자열 (`openssl rand -hex 16`) | 5단계(Cron 활성화) 전 반드시 설정 |
| `VITE_ADMIN_TRIGGER_TOKEN` | 랜덤 문자열 (별도 생성) | ⚠️ 브라우저에 노출되는 값(의도적). '지금 동기화' 버튼용 |

기존 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`는 그대로 둡니다.
**채널 ID와 자동화 ON/OFF는 여기 없습니다** — 4단계 관리자 화면에서 설정합니다.

등록 후 Vercel에서 **재배포**해야 반영됩니다.

---

## 4. 관리자 화면 설정 + 첫 수동 테스트

배포 후 관리자 화면 좌측 메뉴 **[자동화 설정]**으로 이동합니다.

1. **환경 상태** 카드에서 4개 항목이 모두 "설정됨"인지 확인
2. **유튜브** 카드에서:
   - "채널 ID / 계정 ID"에 1단계에서 확인한 채널 ID 입력 (칸 밖을 클릭하면 자동 저장)
   - "자동화 사용" 체크박스 켜기
   - **[지금 동기화]** 버튼 클릭
3. 결과 확인:
   - 카드 하단에 "방금 실행 결과: 성공 · 처리 N건 · 신규 M건" 표시
   - "마지막 동기화" 요약(성공/실패, 처리 수, 신규 수, 소요시간)이 갱신됨
   - 하단 "최근 동기화 로그" 표에 새 행이 추가됨
4. 관리자 화면(주간 데이터 입력)에서 새로 등록된 영상이 보이는지, `title`이 유튜브 원본 제목으로
   잘 들어갔는지 확인
5. **제목 유지 검증(중요)**: 방금 등록된(또는 기존) 영상 하나를 골라 "주간 데이터 입력"에서 `title`을
   수정 → [자동화 설정]에서 다시 [지금 동기화] → **`title`이 되돌아가지 않는지** 확인
6. 문제없으면 며칠간 반복 실행해서 중복 등록/중복 통계 행이 생기지 않는지 재확인 후 5단계로

문제가 있다면 "최근 동기화 로그"의 실패 원인 컬럼과 6번(장애 대응)을 참고하세요.

---

## 5. Cron 활성화

수동 테스트가 안정적으로 통과하면:

1. `CRON_SECRET`이 Vercel에 등록되어 있는지 재확인 (없으면 반드시 지금 등록)
2. `vercel.json`에 아래 `crons` 블록 추가:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "rewrites": [
       { "source": "/(.*)", "destination": "/" }
     ],
     "crons": [
       { "path": "/api/collect-youtube", "schedule": "0 0 * * 1" }
     ]
   }
   ```
   `schedule`은 cron 표현식, **기준 시간대는 UTC**. `0 0 * * 1` = 매주 월요일 UTC 00:00 = 한국시간 월요일 09:00.
3. GitHub push → Vercel 자동 재배포
4. Vercel 대시보드 → **Settings → Cron Jobs**에서 등록 확인
5. [자동화 설정] 화면에서 해당 플랫폼의 "Cron 활성화됨" 체크박스를 직접 체크
   (자동 감지가 아니라 운영자가 "설정을 완료했다"고 표시하는 용도입니다)
6. 첫 자동 실행 이후 "최근 동기화 로그"에서 결과 확인

> Vercel Hobby(무료) 플랜은 크론 실행 시각이 최대 1시간까지 지연될 수 있습니다. 주 1회 수집에는 문제없는 수준입니다.

---

## 6. 장애 발생 시 확인 방법

1. **[자동화 설정] 화면의 "최근 동기화 로그"** 를 가장 먼저 확인 (Supabase SQL 없이 바로 확인 가능)
   ```sql
   -- 필요하면 SQL로도 확인 가능
   select * from sync_logs order by started_at desc limit 10;
   ```

2. **원인별 대응**

   | 증상 | 원인 | 조치 |
   |---|---|---|
   | `YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다` | Vercel 환경변수 누락/오타 | [자동화 설정]의 "환경 상태" 카드에서 미설정 항목 확인 후 3단계 재확인 |
   | `자동화가 비활성화 상태입니다` (success:true, 경고만) | 관리자 화면에서 "자동화 사용"이 꺼져 있음 | [자동화 설정]에서 체크박스 켜기 |
   | `automation_settings 조회 실패` / `videos 조회 실패` | Supabase 연결 문제, service_role 키 오류, 마이그레이션 미실행 | 2단계 SQL 재확인, service_role 키 재확인 |
   | 경고에 `quotaExceeded` 포함 | YouTube API 일일 할당량 초과 | 다음날 자동 복구. 빈번하면 Google Cloud Console에서 할당량 증설 신청 |
   | 경고에 특정 영상 ID만 반복 등장 | 해당 영상이 비공개 전환/삭제됨 | 정상 동작(해당 영상만 건너뜀). 필요 시 관리자 화면에서 영상 삭제 |
   | `401 인증되지 않은 요청` | `CRON_SECRET`/`VITE_ADMIN_TRIGGER_TOKEN` 불일치 | 값 재확인, 재배포 여부 확인 |
   | `신규 영상 등록 실패: duplicate key` | `(platform, external_video_id)` 중복 데이터 존재 | Supabase에서 중복 행 확인 후 정리 |

3. **개별 요청 상세 로그**: Vercel 대시보드 → 프로젝트 → **Logs** 탭에서 `/api/collect-youtube` 함수의
   런타임 콘솔 출력 확인

4. **최후 수단**: [자동화 설정]에서 해당 플랫폼 "자동화 사용"을 끄면 Cron이 실행되어도 즉시 종료되어
   더 이상 데이터가 바뀌지 않습니다 (재배포 불필요). 원인 파악 후 다시 켜세요.

---

## 7. 신규 플랫폼(Instagram/Facebook/TikTok) 추가 방법

플랫폼 공통으로 재사용되는 부분:

| 파일 | 재사용 여부 |
|---|---|
| `api/_lib/types.ts` | 그대로 재사용 |
| `api/_lib/supabaseAdmin.ts` | 그대로 재사용 |
| `api/_lib/auth.ts` | 그대로 재사용 |
| `api/_lib/syncLog.ts` | 그대로 재사용 (`platform` 값만 다르게) |
| `automation_settings` / `sync_logs` 테이블 | 그대로 재사용 (플랫폼별 행만 추가) |
| `src/pages/AutomationSettings.tsx` | 그대로 재사용 — `AUTOMATION_PLATFORMS` 배열에 endpoint만 채우면 화면 자동 확장 |
| `api/_lib/youtube.ts` | 플랫폼별로 새로 작성 (`api/_lib/instagram.ts` 등) |
| `api/collect-youtube.ts` | 플랫폼별로 새로 작성 (`api/collect-instagram.ts` 등, 구조 동일) |

추가 순서:
1. `supabase_schema.sql`의 `platform` CHECK 제약에 이미 instagram/facebook/tiktok이 포함되어 있는지 확인 (포함되어 있음)
2. `api/_lib/{platform}.ts` 작성 — `youtube.ts`의 `runYoutubeSync`를 템플릿으로:
   - `automation_settings`에서 `enabled`/`external_account_id` 조회 (동일 패턴)
   - 신규 발견 → 배치 상세조회 → 신규 등록/기존 갱신 → `SyncResult` 반환
   - `external_video_id`는 플랫폼 공통 컬럼이므로 그대로 사용
   - `saves`/`shares` 등 플랫폼별로 다른 지표만 다르게 채움
3. `api/collect-{platform}.ts`를 `api/collect-youtube.ts`와 동일한 구조로 작성 (import만 교체)
4. 해당 플랫폼 전용 API 키를 환경변수로 추가 (예: `INSTAGRAM_ACCESS_TOKEN`) +
   `api/automation-status.ts`의 `platforms` 객체에 한 줄 추가
5. `src/pages/AutomationSettings.tsx`의 `AUTOMATION_PLATFORMS` 배열에서 해당 플랫폼의
   `endpoint`를 `null`에서 실제 경로로 변경 → 화면에 "지금 동기화" 버튼이 자동으로 활성화됨
6. 충분히 수동 테스트 후, `vercel.json`의 `crons` 배열에 새 항목 추가
   ```json
   { "path": "/api/collect-instagram", "schedule": "0 1 * * 1" }
   ```
   (같은 시각에 몰리지 않도록 플랫폼별로 시간을 나눠 배치 권장)

---

## 8. 최종 구조 검토 — 추가 확장이 가능한가?

**결론: 가능합니다. 추가 구조 변경 없이 Instagram/Facebook/TikTok을 동일한 패턴으로 붙일 수 있습니다.**

근거:
- **자연키가 이미 플랫폼 공통**: `videos.platform + videos.external_video_id`로 모든 플랫폼의 "이 영상이
  DB에 있는가"를 동일하게 판별합니다. 플랫폼별로 다른 ID 체계(유튜브 11자, 인스타 shortcode 등)를
  써도 `external_video_id`는 그냥 문자열이라 그대로 수용됩니다.
- **제목 관리 구조가 플랫폼 무관**: `title`(관리자 전용) / `source_title`(원본 추적) 분리는 테이블
  레벨 설계이므로 어떤 플랫폼이 채워 넣든 동일하게 동작합니다.
- **실행/로깅/설정 계층이 이미 분리되어 있음**: `api/_lib/{supabaseAdmin, auth, syncLog}.ts`,
  `automation_settings`, `sync_logs`는 플랫폼 이름을 매개변수로만 받는 범용 구조입니다.
- **관리자 화면이 데이터 기반으로 확장됨**: `AutomationSettings.tsx`는 `automation_settings` 테이블의
  행 4개(이미 생성됨)를 그대로 카드로 렌더링하므로, 코드 수정은 `AUTOMATION_PLATFORMS` 배열의
  `endpoint` 한 줄과 상태 뱃지(`api/automation-status.ts`) 한 줄뿐입니다.
- **오류 격리 패턴이 플랫폼 무관**: 배치/개별 단위 try-catch, `warnings` 누적, `sync_logs` 기록
  전부 `runYoutubeSync`와 동일한 템플릿을 그대로 복사해서 쓸 수 있습니다.

플랫폼별로 실제로 새로 작성해야 하는 부분(구조가 아니라 "내용"의 차이):
- 각 플랫폼 API의 인증 방식 (Instagram/Facebook은 Graph API 액세스 토큰 + 정기 갱신 필요,
  TikTok은 별도 앱 심사가 필요할 수 있음) — 이는 코드 구조 문제가 아니라 각 플랫폼 API 자체의 제약입니다.
- 신규 영상 "목록 조회" API 호출 방식 (유튜브는 업로드 재생목록, 인스타는 미디어 목록 엔드포인트 등)
- `saves`/`shares` 등 플랫폼마다 다른 통계 필드 매핑

즉, **DB 스키마·저장 계층·관리자 UI·인증/로깅 구조는 지금 상태로 확정해도 되고**, 남은 작업은
플랫폼별 `api/_lib/{platform}.ts` 구현(각 플랫폼 API 연동)뿐입니다.

---

## 참고: 자동/수동 데이터 구분과 제목 관리

- `weekly_metrics.source`: 관리자 입력 = `'manual'`, 자동 수집 = `'api'`. 화면 로직은 이 값을 참조하지 않아 안전하게 공존합니다.
- `videos.title`: 화면 표시용. 관리자가 자유롭게 수정하며, 자동화는 최초 등록 시에만 설정하고 이후 절대 덮어쓰지 않습니다.
- `videos.source_title`: 플랫폼 원본 제목. 자동 수집 때마다 최신값으로 갱신됩니다(원본이 바뀌었는지 참고용).
- `videos.external_video_id`: 플랫폼 공통 자연키. `(platform, external_video_id)`로 고유성이 보장됩니다.
- `automation_settings`: 플랫폼별 ON/OFF, 채널ID, Cron 표시 플래그. 관리자 화면에서 직접 관리(재배포 불필요).
- `sync_logs`: 모든 실행 이력(성공/실패 무관). 관리자 화면 [자동화 설정]에서 최근 10건 확인 가능.
