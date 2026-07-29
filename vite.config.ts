import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 설정. React 플러그인만 있으면 개발/빌드 모두 동작합니다.
export default defineConfig({
  plugins: [react()],
})
