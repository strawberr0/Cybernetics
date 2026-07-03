import { useState } from 'react'
import { Composer } from './components/Composer'
import { Header } from './components/Header'
import { MCPPage } from './components/MCPPage'

export default function App() {
  const [page, setPage] = useState<'composer' | 'mcp'>('composer')

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-[#07112e] dark:text-gray-200">
      <Header page={page} onNavigate={setPage} />
      <main className="p-0">
        {page === 'composer' && <Composer />}
        {page === 'mcp' && <MCPPage />}
      </main>
    </div>
  )
}
