/** @type {import('tailwindcss').Config} */
// Tailwind가 클래스를 스캔할 파일 범위. src 아래 모든 파일을 대상으로 합니다.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} }, // 색상/폰트 등 실제 디자인 토큰은 src/theme/theme.ts 에서 관리합니다.
  plugins: [],
}
