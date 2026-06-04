import { Bot, Github, Server, Terminal } from 'lucide-react'

interface HeaderProps {
  page: 'composer' | 'mcp'
  onNavigate: (page: 'composer' | 'mcp') => void
}

export function Header({ page, onNavigate }: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8" />
            <h1 className="text-xl font-bold text-white tracking-tight">Cybernetics</h1>
          </div>
          <nav className="hidden md:flex items-center gap-1 mx-auto">
            <button
              onClick={() => onNavigate('composer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                page === 'composer' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Composer
            </button>
            <button
              onClick={() => onNavigate('mcp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                page === 'mcp' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Server className="w-4 h-4" />
              MCP
            </button>
          </nav>
        </div>
        <a
          href="https://github.com/strawberr0/cybernetics"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <Github className="w-4 h-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </div>
    </header>
  )
}
