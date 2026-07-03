import { useState } from 'react'
import {
  Terminal,
  Server,
  Plus,
  ChevronLeft,
  Trash2,
  Settings,
  Search,
} from 'lucide-react'

interface SessionInfo {
  id: string
  title: string
  adapters: string[]
  updatedAt: number
}

interface AgentSidebarProps {
  activeTab: 'composer' | 'mcp'
  onTabChange: (tab: 'composer' | 'mcp') => void
  sessions: SessionInfo[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteSession: (id: string) => void
  onOpenSettings: () => void
  isCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  fullWidth?: boolean
}

export function AgentSidebar({
  activeTab,
  onTabChange,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenSettings,
  isCollapsed: controlledCollapsed,
  onCollapsedChange,
  fullWidth = false,
}: AgentSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = controlledCollapsed ?? internalCollapsed
  const setIsCollapsed = (value: boolean) => {
    setInternalCollapsed(value)
    onCollapsedChange?.(value)
  }
  const [sessionSearch, setSessionSearch] = useState('')

  const navItems = [
    { id: 'composer' as const, label: 'Composer', icon: Terminal },
    { id: 'mcp' as const, label: 'MCP', icon: Server },
  ]

  const filteredSessions = sessions.filter(
    s => !sessionSearch || s.title.toLowerCase().includes(sessionSearch.toLowerCase()),
  )

  return (
    <aside
      className={`
        h-full flex flex-col transition-all duration-300 ease-in-out relative
        ${fullWidth ? 'w-full' : isCollapsed ? 'w-16' : 'w-64'}
        bg-gray-50 dark:bg-[#0a0a0a]
        ${fullWidth ? '' : 'border-r border-gray-200 dark:border-gray-800'}
      `}
    >
      {!fullWidth && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-1/2 -translate-y-1/2 -right-3 z-10 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={14} className={`transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      )}

      <nav className="p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg
                transition-colors duration-200
                ${isCollapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              <Icon size={18} />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {!isCollapsed && activeTab === 'composer' && (
        <div className="flex-1 overflow-y-auto px-2">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
              Sessions
            </span>
          </div>

          <button
            onClick={onNewSession}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">New session</span>
          </button>

          {sessions.length > 2 && (
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-900">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-400"
                  placeholder="Search..."
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            {filteredSessions.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-600 px-3 py-2">No sessions yet</p>
            ) : (
              filteredSessions.map((s) => (
                <div
                  key={s.id}
                  className={`
                    group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
                    transition-colors duration-200
                    ${activeSessionId === s.id
                      ? 'bg-gray-200 dark:bg-gray-800'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-900'
                    }
                  `}
                  onClick={() => onSelectSession(s.id)}
                >
                  <Terminal size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                    {s.title}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded transition-opacity"
                  >
                    <Trash2 size={12} className="text-gray-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex-1" />

      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={onOpenSettings}
          className={`
            w-full flex items-center gap-2 px-3 py-2 rounded-lg
            text-gray-600 dark:text-gray-400
            hover:bg-gray-200 dark:hover:bg-gray-900
            hover:text-gray-900 dark:hover:text-white
            transition-colors duration-200
            ${isCollapsed ? 'justify-center' : ''}
          `}
          title="Settings"
        >
          <Settings size={18} />
          {!isCollapsed && <span className="text-sm">Settings</span>}
        </button>
      </div>
    </aside>
  )
}

export default AgentSidebar
