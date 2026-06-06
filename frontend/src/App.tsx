import { useState } from 'react'
import { Composer } from './components/Composer'
import { Header } from './components/Header'
import { MCPPage } from './components/MCPPage'

export default function App() {
  const [page, setPage] = useState<'composer' | 'mcp'>('composer')

  return (
    <div className="min-h-screen bg-[#d8d4cd] text-[#070b16]">
      <Header page={page} onNavigate={setPage} />
      <main className="p-0">
        {page === 'composer' && <Composer />}
        {page === 'mcp' && <MCPPage />}
      </main>
    </div>
  )
}
