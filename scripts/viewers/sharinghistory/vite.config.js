import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createRequire } from 'module'
import { dirname } from 'path'

export default defineConfig(() => {
  const dataPackage = process.env.DATA_PACKAGE || '@museumwnf/sharinghistory-data'

  const require = createRequire(import.meta.url)
  let dataPackageDir
  try {
    dataPackageDir = dirname(require.resolve(`${dataPackage}/package.json`))
  } catch {
    throw new Error(
      `Data package "${dataPackage}" is not installed.\n` +
      `Run: npm install\n` +
      `Or set DATA_PACKAGE in .env to the correct package name.`
    )
  }

  return {
    plugins: [vue()],
    resolve: {
      alias: { '@inventory-data': dataPackageDir },
    },
  }
})
