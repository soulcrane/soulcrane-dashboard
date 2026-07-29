/// <reference types="vite/client" />
// Vite 환경 타입 선언.

// 우리가 쓰는 환경변수의 타입을 명시 → 오타 방지 + 자동완성
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
