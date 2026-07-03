import { useState, useRef, useCallback } from 'react'
import { Composer } from './components/Composer'
import { Header } from './components/Header'
import { MCPPage } from './components/MCPPage'
import { AgentSidebar } from './components/AgentSidebar'

interface SessionInfo {
  id: string
  title: string
  adapters: string[]
  updatedAt: number
}

export default function App() {
  const [page, setPage] = useState<'composer' | 'mcp'>('composer')
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const loadSessionRef = useRef<(id: string) => void>(() => {})
  const deleteSessionRef = useRef<(id: string) => void>(() => {})
  const newSessionRef = useRef<() => void>(() => {})

  const handleSessionsChange = useCallback((s: SessionInfo[]) => {
    setSessions(s)
  }, [])

  const handleActiveSessionChange = useCallback((id: string | null) => {
    setActiveSessionId(id)
  }, [])

  const registerLoadSession = useCallback((fn: (id: string) => void) => {
    loadSessionRef.current = fn
  }, [])

  const registerDeleteSession = useCallback((fn: (id: string) => void) => {
    deleteSessionRef.current = fn
  }, [])

  const registerNewSession = useCallback((fn: () => void) => {
    newSessionRef.current = fn
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    loadSessionRef.current(id)
  }, [])

  const handleDeleteSession = useCallback((id: string) => {
    deleteSessionRef.current(id)
  }, [])

  const handleNewSession = useCallback(() => {
    newSessionRef.current()
  }, [])

  const handleOpenSettings = useCallback(() => {
    window.dispatchEvent(new Event('arqon-agent-open-settings'))
  }, [])

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-200 overflow-hidden">
      <Header page={page} onNavigate={setPage} />
      <div className="flex flex-1 min-h-0">
        <AgentSidebar
          activeTab={page}
          onTabChange={setPage}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onOpenSettings={handleOpenSettings}
        />
        <main className="flex-1 min-w-0 overflow-hidden">
          {page === 'composer' && (
            <Composer
              onSessionsChange={handleSessionsChange}
              onActiveSessionChange={handleActiveSessionChange}
              registerLoadSession={registerLoadSession}
              registerDeleteSession={registerDeleteSession}
              registerNewSession={registerNewSession}
            />
          )}
          {page === 'mcp' && <MCPPage />}
        </main>
      </div>
    </div>
  )
}
